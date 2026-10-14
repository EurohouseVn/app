import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OperationsInventoryTransactionType,
  OperationsRemnantStatus,
  Prisma,
  WorkshopInstallationStatus,
  WorkshopQcResult,
  WorkshopWorkOrderStatus,
  WorkshopWorkOrderType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryCommandService } from '../inventory/inventory-command.service';
import { assertInventoryMutationAllowed } from '../inventory/inventory-mutation-policy';
import { workshopOperationsFeatureFlags } from './workshop-operations.feature-flags';
import { WorkshopAccessService } from './workshop-access.service';
import {
  assertInstallationCanComplete,
  assertInstallationTransition,
  assertQcCompletion,
  assertQcFailureEvidence,
  assertQcRequiredChecks,
  assertQrEntityAuthorized,
  assertRemnantTransition,
  assertPriceBookVersionCanActivate,
  assertWorkOrderTransition,
  assertWarrantyTransition,
  calculateQuickQuoteLines,
  inventoryBalance,
  installationChecklistComplete,
  nextPriceBookVersion,
  organizationScope,
  resolveOfflineMutation,
} from './workshop-operations.rules';

type JsonInput = Prisma.InputJsonValue;

type InventoryTransactionInput = {
  transactionType: OperationsInventoryTransactionType;
  stockItemId: string;
  lotId?: string;
  lotCode?: string;
  quantity: number;
  adjustmentDelta?: number;
  fromWarehouseId?: string;
  fromLocationId?: string;
  toWarehouseId?: string;
  toLocationId?: string;
  reservationId?: string;
  sourceType?: string;
  sourceId?: string;
  reason?: string;
  note?: string;
};

const WORK_ORDER_ACTION_STATUS: Record<string, WorkshopWorkOrderStatus> = {
  READY: WorkshopWorkOrderStatus.READY,
  START: WorkshopWorkOrderStatus.IN_PROGRESS,
  RESUME: WorkshopWorkOrderStatus.IN_PROGRESS,
  PAUSE: WorkshopWorkOrderStatus.PAUSED,
  DONE: WorkshopWorkOrderStatus.DONE,
  CANCEL: WorkshopWorkOrderStatus.CANCELLED,
};

@Injectable()
export class WorkshopOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: InventoryCommandService,
    private readonly access: WorkshopAccessService,
  ) {}

  flags() {
    return workshopOperationsFeatureFlags();
  }

  private org(user: JwtUser, requestedOrganizationId?: string) {
    return organizationScope(user, requestedOrganizationId);
  }

  private code(prefix: string) {
    return `${prefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  private async project(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId } });
    if (!project) throw new NotFoundException('Không tìm thấy công trình trong tổ chức này.');
    return project;
  }

  private eventData(
    organizationId: string,
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: JsonInput,
  ): Prisma.WorkshopDomainEventOutboxCreateInput {
    return { organizationId, eventType, aggregateType, aggregateId, payload };
  }

  private auditData(input: {
    organizationId: string;
    entityType: string;
    entityId: string;
    action: string;
    actorId: string;
    fromStatus?: string;
    toStatus?: string;
    reason?: string;
    referenceIds?: JsonInput;
    metadata?: JsonInput;
  }): Prisma.WorkshopAuditEventCreateInput {
    return {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      fromStatus: input.fromStatus ?? '',
      toStatus: input.toStatus ?? '',
      reason: input.reason ?? '',
      referenceIds: input.referenceIds,
      metadata: input.metadata,
    };
  }

  // Sprint A1: customer, project and site survey.
  async customers(user: JwtUser, organizationId?: string, search = '') {
    const orgId = this.org(user, organizationId);
    return this.prisma.workshopCustomer.findMany({
      where: {
        organizationId: orgId,
        active: true,
        ...(search.trim()
          ? { OR: [{ name: { contains: search.trim(), mode: 'insensitive' } }, { phone: { contains: search.trim() } }] }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCustomer(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('Vui lòng nhập tên khách hàng.');
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.workshopCustomer.create({
        data: {
          organizationId,
          code: String(body.code ?? '').trim() || this.code('KH'),
          name,
          phone: String(body.phone ?? '').trim(),
          email: String(body.email ?? '').trim(),
          address: String(body.address ?? '').trim(),
          taxCode: String(body.taxCode ?? '').trim(),
          note: String(body.note ?? '').trim(),
          createdById: user.sub,
        },
      });
      await tx.workshopAuditEvent.create({ data: this.auditData({ organizationId, entityType: 'Customer', entityId: customer.id, action: 'CREATE', actorId: user.sub }) });
      return customer;
    });
  }

  async projects(user: JwtUser, organizationId?: string) {
    const orgId = this.org(user, organizationId);
    return this.prisma.project.findMany({
      where: { organizationId: orgId },
      include: { customerV2: true, sites: { include: { zones: true } }, openings: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async projectFinancialPdfData(user: JwtUser, projectId: string, requestedOrganizationId?: string) {
    const organizationId = this.org(user, requestedOrganizationId);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: {
        costs: { orderBy: { createdAt: 'asc' } },
        cashTransactions: { orderBy: [{ transDate: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!project) throw new NotFoundException('Không tìm thấy công trình trong tổ chức này.');
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    return {
      ...project,
      customCosts: project.costs,
      transactions: project.cashTransactions,
      issuer: organization ? {
        name: organization.name,
        productionName: organization.productionName || organization.name,
        address: organization.address || '',
        phone: organization.phone || '',
        email: organization.email || '',
        fanpage: organization.fanpage || '',
        mainCategories: organization.mainCategories || '',
        logoUrl: organization.logoUrl || '',
      } : null,
    };
  }

  async createOperationsProject(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('Vui lòng nhập tên công trình.');
    const customerId = body.customerId ? String(body.customerId) : undefined;
    if (customerId) {
      const customer = await this.prisma.workshopCustomer.findFirst({ where: { id: customerId, organizationId } });
      if (!customer) throw new NotFoundException('Không tìm thấy khách hàng trong tổ chức này.');
    }
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          code: this.code('CT'),
          name,
          organizationId,
          customerV2Id: customerId,
          ownerId: user.sub,
          customerName: String(body.customerName ?? '').trim(),
          customerPhone: String(body.customerPhone ?? '').trim(),
          address: String(body.address ?? '').trim(),
          note: String(body.note ?? '').trim(),
        },
      });
      await tx.workshopActivity.create({
        data: { organizationId, projectId: project.id, customerId, activityType: 'PROJECT_CREATED', title: 'Tạo công trình', actorId: user.sub },
      });
      await tx.workshopDomainEventOutbox.create({ data: this.eventData(organizationId, 'PROJECT_CREATED', 'Project', project.id, { projectId: project.id }) });
      return project;
    });
  }

  async updateOperationsProject(user: JwtUser, projectId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.project(projectId, organizationId);
    const allowed = [
      'name', 'customerName', 'customerPhone', 'address', 'status', 'contractValue',
      'estimatedValue', 'incurredValue', 'incurredType', 'settledValue', 'quotationId',
      'costAluminum', 'costAccessory', 'costLockHinge', 'costGlass', 'costGasket',
      'costSilicone', 'costScrew', 'costLabor', 'costPartnerPct', 'costOther',
      'extraRevenue', 'note', 'images', 'scale', 'productsUsed',
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowed) if (body[key] !== undefined) data[key] = body[key];
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({ where: { id: projectId }, data });
      await tx.workshopActivity.create({ data: { organizationId, projectId, activityType: 'PROJECT_UPDATED', title: 'Cập nhật công trình', actorId: user.sub } });
      return updated;
    });
  }

  async deleteOperationsProject(user: JwtUser, projectId: string, requestedOrganizationId?: string) {
    const organizationId = this.org(user, requestedOrganizationId);
    await this.project(projectId, organizationId);
    const [installations, warrantyAssets] = await Promise.all([
      this.prisma.workshopInstallationJob.count({ where: { projectId, organizationId } }),
      this.prisma.workshopWarrantyAsset.count({ where: { projectId, organizationId } }),
    ]);
    if (installations || warrantyAssets) throw new ConflictException('Không thể xóa công trình đã có lắp đặt hoặc tài sản bảo hành.');
    await this.prisma.project.delete({ where: { id: projectId } });
    return { deleted: true };
  }

  async survey(user: JwtUser, projectId: string, organizationId?: string) {
    const orgId = this.org(user, organizationId);
    await this.project(projectId, orgId);
    const [project, photos, notes] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          customerV2: true,
          sites: { include: { zones: { include: { openings: { include: { measurements: { orderBy: { revision: 'desc' } }, doorRequest: true } } } } } },
          openings: { where: { zoneId: null }, include: { measurements: { orderBy: { revision: 'desc' } }, doorRequest: true } },
        },
      }),
      this.prisma.workshopSitePhoto.findMany({ where: { organizationId: orgId, projectId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.workshopSiteNote.findMany({ where: { organizationId: orgId, projectId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { project, photos, notes };
  }

  async createSite(user: JwtUser, projectId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.project(projectId, organizationId);
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('Vui lòng nhập tên địa điểm khảo sát.');
    return this.prisma.projectSite.create({
      data: {
        organizationId,
        projectId,
        code: String(body.code ?? '').trim() || this.code('SITE'),
        name,
        address: String(body.address ?? '').trim(),
        contactName: String(body.contactName ?? '').trim(),
        contactPhone: String(body.contactPhone ?? '').trim(),
        note: String(body.note ?? '').trim(),
        createdById: user.sub,
      },
    });
  }

  async createZone(user: JwtUser, siteId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const site = await this.prisma.projectSite.findFirst({ where: { id: siteId, organizationId } });
    if (!site) throw new NotFoundException('Không tìm thấy địa điểm trong tổ chức này.');
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('Vui lòng nhập tên tầng hoặc khu vực.');
    return this.prisma.projectZone.create({
      data: {
        organizationId,
        projectSiteId: siteId,
        code: String(body.code ?? '').trim() || this.code('ZONE'),
        name,
        floorLabel: String(body.floorLabel ?? '').trim(),
        sortOrder: Number(body.sortOrder) || 0,
      },
    });
  }

  async createOpening(user: JwtUser, projectId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.project(projectId, organizationId);
    const zoneId = body.zoneId ? String(body.zoneId) : undefined;
    if (zoneId) {
      const zone = await this.prisma.projectZone.findFirst({ where: { id: zoneId, organizationId } });
      if (!zone) throw new NotFoundException('Không tìm thấy khu vực trong tổ chức này.');
    }
    const widthMm = body.widthMm === undefined ? undefined : Math.round(Number(body.widthMm));
    const heightMm = body.heightMm === undefined ? undefined : Math.round(Number(body.heightMm));
    if ((widthMm !== undefined && widthMm <= 0) || (heightMm !== undefined && heightMm <= 0)) {
      throw new BadRequestException('Kích thước ô chờ phải lớn hơn 0 mm.');
    }
    return this.prisma.$transaction(async (tx) => {
      const opening = await tx.workshopOpening.create({
        data: {
          organizationId,
          projectId,
          zoneId,
          stableCode: String(body.stableCode ?? '').trim() || this.code('OPEN'),
          description: String(body.description ?? '').trim(),
          widthMm,
          heightMm,
          wallThicknessMm: body.wallThicknessMm === undefined ? undefined : Math.round(Number(body.wallThicknessMm)),
          sillLevelMm: body.sillLevelMm === undefined ? undefined : Math.round(Number(body.sillLevelMm)),
          installationNotes: String(body.installationNotes ?? '').trim(),
          measurementStatus: widthMm && heightMm ? 'MEASURED' : 'DRAFT',
          createdById: user.sub,
          ...(body.intentType
            ? {
                doorRequest: {
                  create: {
                    organizationId,
                    intentType: String(body.intentType),
                    operationType: String(body.operationType ?? ''),
                    leafCount: body.leafCount === undefined ? undefined : Math.round(Number(body.leafCount)),
                    glassIntent: String(body.glassIntent ?? ''),
                    hardwareIntent: String(body.hardwareIntent ?? ''),
                    colorIntent: String(body.colorIntent ?? ''),
                    note: String(body.intentNote ?? ''),
                  },
                },
              }
            : {}),
        },
        include: { doorRequest: true },
      });
      if (widthMm && heightMm) {
        await tx.openingMeasurement.create({
          data: { organizationId, openingId: opening.id, revision: 1, widthMm, heightMm, status: 'MEASURED', measuredById: user.sub },
        });
      }
      await tx.workshopActivity.create({
        data: { organizationId, projectId, activityType: 'OPENING_CREATED', title: `Tạo ô chờ ${opening.stableCode}`, referenceType: 'Opening', referenceId: opening.id, actorId: user.sub },
      });
      return opening;
    });
  }

  async recordMeasurement(user: JwtUser, openingId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const opening = await this.prisma.workshopOpening.findFirst({ where: { id: openingId, organizationId } });
    if (!opening) throw new NotFoundException('Không tìm thấy ô chờ trong tổ chức này.');
    const widthMm = Math.round(Number(body.widthMm));
    const heightMm = Math.round(Number(body.heightMm));
    if (!(widthMm > 0) || !(heightMm > 0)) throw new BadRequestException('Chiều rộng và chiều cao phải lớn hơn 0 mm.');
    const revision = opening.revision + 1;
    return this.prisma.$transaction(async (tx) => {
      const measurement = await tx.openingMeasurement.create({
        data: {
          organizationId,
          openingId,
          revision,
          widthMm,
          heightMm,
          wallThicknessMm: body.wallThicknessMm === undefined ? opening.wallThicknessMm : Math.round(Number(body.wallThicknessMm)),
          sillLevelMm: body.sillLevelMm === undefined ? opening.sillLevelMm : Math.round(Number(body.sillLevelMm)),
          status: 'MEASURED',
          note: String(body.note ?? ''),
          measuredById: user.sub,
          supersedesId: opening.revision > 0 ? `${openingId}:${opening.revision}` : undefined,
        },
      });
      await tx.workshopOpening.update({
        where: { id: openingId },
        data: { widthMm, heightMm, wallThicknessMm: measurement.wallThicknessMm, sillLevelMm: measurement.sillLevelMm, revision, measurementStatus: 'MEASURED' },
      });
      await tx.workshopAuditEvent.create({ data: this.auditData({ organizationId, entityType: 'Opening', entityId: openingId, action: 'MEASURE', actorId: user.sub, referenceIds: { measurementId: measurement.id, revision } }) });
      return measurement;
    });
  }

  async addSiteNote(user: JwtUser, projectId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.project(projectId, organizationId);
    const content = String(body.content ?? '').trim();
    if (!content) throw new BadRequestException('Nội dung ghi chú không được để trống.');
    if (body.openingId) {
      const opening = await this.prisma.workshopOpening.findFirst({ where: { id: String(body.openingId), projectId, organizationId } });
      if (!opening) throw new NotFoundException('Không tìm thấy ô chờ trong công trình này.');
    }
    return this.prisma.workshopSiteNote.create({
      data: {
        organizationId,
        projectId,
        openingId: body.openingId ? String(body.openingId) : undefined,
        noteType: String(body.noteType ?? 'TEXT'),
        content,
        voiceObjectId: body.voiceObjectId ? String(body.voiceObjectId) : undefined,
        metadata: body.metadata as JsonInput | undefined,
        createdById: user.sub,
      },
    });
  }

  async addSitePhoto(user: JwtUser, projectId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.project(projectId, organizationId);
    const url = String(body.url ?? '').trim();
    if (!url) throw new BadRequestException('Ảnh khảo sát phải có URL lưu trữ hợp lệ.');
    return this.prisma.workshopSitePhoto.create({
      data: {
        organizationId,
        projectId,
        openingId: body.openingId ? String(body.openingId) : undefined,
        storageObjectId: body.storageObjectId ? String(body.storageObjectId) : undefined,
        url,
        caption: String(body.caption ?? ''),
        metadata: body.metadata as JsonInput | undefined,
        createdById: user.sub,
      },
    });
  }

  // Sprint A2: workshop master data and transaction-led inventory.
  async masterData(user: JwtUser, organizationId?: string) {
    const orgId = this.org(user, organizationId);
    const [settings, teams, warehouses, machines, suppliers] = await Promise.all([
      this.prisma.workshopSettings.findUnique({ where: { organizationId: orgId } }),
      this.prisma.workshopTeam.findMany({ where: { organizationId: orgId }, include: { members: true }, orderBy: { name: 'asc' } }),
      this.prisma.workshopWarehouse.findMany({ where: { organizationId: orgId }, include: { locations: true }, orderBy: { name: 'asc' } }),
      this.prisma.workshopMachine.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' } }),
      this.prisma.workshopSupplier.findMany({ where: { organizationId: orgId }, include: { materials: true }, orderBy: { name: 'asc' } }),
    ]);
    return { settings, teams, warehouses, machines, suppliers };
  }

  async saveSettings(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    return this.prisma.workshopSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        timezone: String(body.timezone ?? 'Asia/Ho_Chi_Minh'),
        defaultCurrency: String(body.defaultCurrency ?? 'VND'),
        defaultWarehouseId: body.defaultWarehouseId ? String(body.defaultWarehouseId) : undefined,
        quoteValidityDays: Number(body.quoteValidityDays) || 15,
        warrantyMonths: Number(body.warrantyMonths) || 12,
        settings: body.settings as JsonInput | undefined,
      },
      update: {
        timezone: body.timezone === undefined ? undefined : String(body.timezone),
        defaultCurrency: body.defaultCurrency === undefined ? undefined : String(body.defaultCurrency),
        defaultWarehouseId: body.defaultWarehouseId === undefined ? undefined : String(body.defaultWarehouseId || ''),
        quoteValidityDays: body.quoteValidityDays === undefined ? undefined : Number(body.quoteValidityDays),
        warrantyMonths: body.warrantyMonths === undefined ? undefined : Number(body.warrantyMonths),
        settings: body.settings as JsonInput | undefined,
      },
    });
  }

  async createTeam(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('Vui lòng nhập tên tổ đội.');
    return this.prisma.workshopTeam.create({
      data: { organizationId, code: String(body.code ?? '').trim() || this.code('TEAM'), name, teamType: String(body.teamType ?? 'PRODUCTION') },
    });
  }

  async createWarehouse(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('Vui lòng nhập tên kho.');
    return this.prisma.workshopWarehouse.create({
      data: { organizationId, code: String(body.code ?? '').trim() || this.code('WH'), name, address: String(body.address ?? '') },
    });
  }

  async createWarehouseLocation(user: JwtUser, warehouseId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const warehouse = await this.prisma.workshopWarehouse.findFirst({ where: { id: warehouseId, organizationId } });
    if (!warehouse) throw new NotFoundException('Không tìm thấy kho trong tổ chức này.');
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('Vui lòng nhập tên vị trí kho.');
    return this.prisma.workshopWarehouseLocation.create({
      data: { organizationId, warehouseId, code: String(body.code ?? '').trim() || this.code('LOC'), name, locationType: String(body.locationType ?? 'RACK') },
    });
  }

  async createMachine(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const name = String(body.name ?? '').trim();
    const machineType = String(body.machineType ?? '').trim();
    if (!name || !machineType) throw new BadRequestException('Tên máy và loại máy là bắt buộc.');
    return this.prisma.workshopMachine.create({
      data: {
        organizationId,
        code: String(body.code ?? '').trim() || this.code('MACHINE'),
        name,
        machineType,
        kerfMm: body.kerfMm === undefined ? undefined : Number(body.kerfMm),
        minimumCutMm: body.minimumCutMm === undefined ? undefined : Math.round(Number(body.minimumCutMm)),
        maximumStockMm: body.maximumStockMm === undefined ? undefined : Math.round(Number(body.maximumStockMm)),
        angleCapabilities: body.angleCapabilities as JsonInput | undefined,
        note: String(body.note ?? ''),
      },
    });
  }

  async createSupplier(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException('Vui lòng nhập tên nhà cung cấp.');
    return this.prisma.workshopSupplier.create({
      data: {
        organizationId,
        code: String(body.code ?? '').trim() || this.code('SUP'),
        name,
        phone: String(body.phone ?? ''),
        email: String(body.email ?? ''),
        address: String(body.address ?? ''),
        leadTimeDays: body.leadTimeDays === undefined ? undefined : Math.round(Number(body.leadTimeDays)),
        minimumOrder: body.minimumOrder === undefined ? undefined : Number(body.minimumOrder),
        paymentTerms: String(body.paymentTerms ?? ''),
        deliveryNotes: String(body.deliveryNotes ?? ''),
      },
    });
  }

  async stockItems(user: JwtUser, organizationId?: string) {
    const orgId = this.org(user, organizationId);
    const items = await this.prisma.workshopStockItem.findMany({
      where: { organizationId: orgId, active: true },
      include: { lots: { where: { closedAt: null } }, reservations: { where: { status: 'ACTIVE' } }, remnants: { where: { status: { in: ['AVAILABLE', 'RESERVED'] } } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    const transactions = await this.prisma.workshopInventoryTransaction.findMany({
      where: { organizationId: orgId },
      select: { stockItemId: true, transactionType: true, quantity: true, adjustmentDelta: true },
    });
    return items.map((item) => {
      const itemTransactions = transactions.filter((transaction) => transaction.stockItemId === item.id);
      const onHand = inventoryBalance(itemTransactions);
      const reserved = item.reservations.reduce((sum, reservation) => sum + Number(reservation.quantity) - Number(reservation.consumedQty), 0);
      return { ...item, onHand, reserved, available: onHand - reserved };
    });
  }

  async createStockItem(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const code = String(body.code ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (!code || !name) throw new BadRequestException('Mã và tên vật tư là bắt buộc.');
    return this.prisma.workshopStockItem.create({
      data: {
        organizationId,
        code,
        name,
        category: String(body.category ?? 'OTHER'),
        unit: String(body.unit ?? 'unit'),
        materialRefType: String(body.materialRefType ?? 'MANUAL'),
        materialRefId: body.materialRefId ? String(body.materialRefId) : undefined,
        finishKey: String(body.finishKey ?? ''),
        minimumLevel: Number(body.minimumLevel) || 0,
      },
    });
  }

  private async itemBalance(tx: Prisma.TransactionClient, organizationId: string, stockItemId: string) {
    const transactions = await tx.workshopInventoryTransaction.findMany({
      where: { organizationId, stockItemId },
      select: { transactionType: true, quantity: true, adjustmentDelta: true },
    });
    const reservations = await tx.workshopInventoryReservation.findMany({
      where: { organizationId, stockItemId, status: 'ACTIVE' },
      select: { quantity: true, consumedQty: true },
    });
    const onHand = inventoryBalance(transactions);
    const reserved = reservations.reduce((sum, item) => sum + Number(item.quantity) - Number(item.consumedQty), 0);
    return { onHand, reserved, available: onHand - reserved };
  }

  async transactInventory(user: JwtUser, input: InventoryTransactionInput, idempotencyKey: string, requestedOrganizationId?: string) {
    const organizationId = this.org(user, requestedOrganizationId);
    assertInventoryMutationAllowed({ actorId: user.sub, role: user.role, organizationId: user.organizationId }, 'WORKSHOP_STOCK', organizationId);
    if (!idempotencyKey) throw new BadRequestException('Thiếu Idempotency-Key.');
    return this.commands.execute(
      { idempotencyKey, actorId: user.sub, organizationId, ownerType: 'WORKSHOP_STOCK', ownerId: organizationId, command: `WORKSHOP_${input.transactionType}` },
      input,
      async (tx) => {
        const item = await tx.workshopStockItem.findFirst({ where: { id: input.stockItemId, organizationId, active: true } });
        if (!item) throw new NotFoundException('Không tìm thấy vật tư trong kho của tổ chức này.');
        const quantity = Math.abs(Number(input.quantity));
        if (!(quantity > 0)) throw new BadRequestException('Số lượng giao dịch phải lớn hơn 0.');
        let lotId = input.lotId;
        if (lotId) {
          const lot = await tx.workshopStockLot.findFirst({ where: { id: lotId, organizationId, stockItemId: item.id } });
          if (!lot) throw new NotFoundException('Không tìm thấy lô vật tư trong tổ chức này.');
        } else if (input.transactionType === 'RECEIVE') {
          if (!input.toWarehouseId) throw new BadRequestException('Nhập kho phải chọn kho nhận.');
          const lot = await tx.workshopStockLot.create({
            data: {
              organizationId,
              stockItemId: item.id,
              lotCode: input.lotCode?.trim() || this.code('LOT'),
              warehouseId: input.toWarehouseId,
              locationId: input.toLocationId,
              receivedAt: new Date(),
            },
          });
          lotId = lot.id;
        }

        const before = await this.itemBalance(tx, organizationId, item.id);
        if (['ISSUE', 'SCRAP'].includes(input.transactionType) && before.available < quantity) {
          throw new ConflictException(`Tồn khả dụng chỉ còn ${before.available} ${item.unit}.`);
        }

        let reservationId = input.reservationId;
        if (input.transactionType === 'RESERVE') {
          if (before.available < quantity) throw new ConflictException(`Tồn khả dụng chỉ còn ${before.available} ${item.unit}.`);
          const reservation = await tx.workshopInventoryReservation.create({
            data: {
              organizationId,
              stockItemId: item.id,
              lotId,
              quantity,
              referenceType: input.sourceType || 'MANUAL',
              referenceId: input.sourceId || this.code('REF'),
              reservedById: user.sub,
            },
          });
          reservationId = reservation.id;
        }
        if (input.transactionType === 'UNRESERVE') {
          if (!reservationId) throw new BadRequestException('UNRESERVE phải có reservationId.');
          const reservation = await tx.workshopInventoryReservation.findFirst({ where: { id: reservationId, organizationId, status: 'ACTIVE' } });
          if (!reservation) throw new NotFoundException('Không tìm thấy phiếu giữ tồn đang hoạt động.');
          await tx.workshopInventoryReservation.update({ where: { id: reservation.id }, data: { status: 'RELEASED', releasedAt: new Date() } });
        }
        if (input.transactionType === 'ADJUST' && (!Number.isFinite(input.adjustmentDelta) || Number(input.adjustmentDelta) === 0)) {
          throw new BadRequestException('ADJUST phải có adjustmentDelta khác 0.');
        }

        const transaction = await tx.workshopInventoryTransaction.create({
          data: {
            organizationId,
            transactionType: input.transactionType,
            stockItemId: item.id,
            lotId,
            quantity,
            adjustmentDelta: input.transactionType === 'ADJUST' ? Number(input.adjustmentDelta) : undefined,
            unit: item.unit,
            fromWarehouseId: input.fromWarehouseId,
            fromLocationId: input.fromLocationId,
            toWarehouseId: input.toWarehouseId,
            toLocationId: input.toLocationId,
            reservationId,
            sourceType: input.sourceType ?? '',
            sourceId: input.sourceId,
            reason: input.reason ?? '',
            note: input.note ?? '',
            actorId: user.sub,
            idempotencyKey,
          },
        });
        const after = await this.itemBalance(tx, organizationId, item.id);
        await tx.workshopAuditEvent.create({ data: this.auditData({ organizationId, entityType: 'StockItem', entityId: item.id, action: input.transactionType, actorId: user.sub, referenceIds: { transactionId: transaction.id }, metadata: { before, after } }) });
        return { transaction, balance: after };
      },
    );
  }

  async remnants(user: JwtUser, organizationId?: string) {
    const orgId = this.org(user, organizationId);
    return this.prisma.workshopStockRemnant.findMany({
      where: { organizationId: orgId },
      include: { stockItem: true },
      orderBy: [{ status: 'asc' }, { lengthMm: 'desc' }],
    });
  }

  async createRemnant(user: JwtUser, body: Record<string, unknown>, idempotencyKey: string) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    assertInventoryMutationAllowed({ actorId: user.sub, role: user.role, organizationId: user.organizationId }, 'WORKSHOP_STOCK', organizationId);
    const stockItemId = String(body.stockItemId ?? '');
    const lengthMm = Math.round(Number(body.lengthMm));
    if (!stockItemId || !(lengthMm > 0)) throw new BadRequestException('Vật tư và chiều dài đầu mẩu là bắt buộc.');
    return this.commands.execute(
      { idempotencyKey, actorId: user.sub, organizationId, ownerType: 'WORKSHOP_STOCK', ownerId: organizationId, command: 'CREATE_REMNANT' },
      body,
      async (tx) => {
        const item = await tx.workshopStockItem.findFirst({ where: { id: stockItemId, organizationId } });
        if (!item) throw new NotFoundException('Không tìm thấy vật tư trong tổ chức này.');
        return tx.workshopStockRemnant.create({
          data: {
            organizationId,
            stockItemId,
            lotId: body.lotId ? String(body.lotId) : undefined,
            materialIdentity: String(body.materialIdentity ?? item.code),
            finishKey: String(body.finishKey ?? item.finishKey),
            lengthMm,
            quantity: Math.max(1, Math.round(Number(body.quantity) || 1)),
            warehouseId: String(body.warehouseId ?? ''),
            locationId: body.locationId ? String(body.locationId) : undefined,
            rackLocation: String(body.rackLocation ?? ''),
            sourceTransactionId: body.sourceTransactionId ? String(body.sourceTransactionId) : undefined,
            sourceCutPlanRef: body.sourceCutPlanRef ? String(body.sourceCutPlanRef) : undefined,
          },
        });
      },
    );
  }

  async transitionRemnant(user: JwtUser, remnantId: string, body: Record<string, unknown>, idempotencyKey: string) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const toStatus = String(body.status ?? '') as OperationsRemnantStatus;
    return this.commands.execute(
      { idempotencyKey, actorId: user.sub, organizationId, ownerType: 'WORKSHOP_STOCK', ownerId: organizationId, command: `REMNANT_${toStatus}` },
      body,
      async (tx) => {
        const remnant = await tx.workshopStockRemnant.findFirst({ where: { id: remnantId, organizationId } });
        if (!remnant) throw new NotFoundException('Không tìm thấy đầu mẩu trong tổ chức này.');
        assertRemnantTransition(remnant.status, toStatus);
        return tx.workshopStockRemnant.update({
          where: { id: remnant.id },
          data: {
            status: toStatus,
            reservedByRef: toStatus === 'RESERVED' ? String(body.reservedByRef ?? '') : toStatus === 'AVAILABLE' ? null : undefined,
            reservedAt: toStatus === 'RESERVED' ? new Date() : toStatus === 'AVAILABLE' ? null : undefined,
            consumedAt: toStatus === 'CONSUMED' ? new Date() : undefined,
            consumedByTransactionId: toStatus === 'CONSUMED' && body.transactionId ? String(body.transactionId) : undefined,
          },
        });
      },
    );
  }

  // Sprint A3: versioned commercial pricing, quick quote and generic work orders.
  async priceBooks(user: JwtUser, organizationId?: string) {
    const orgId = this.org(user, organizationId);
    return this.prisma.priceBook.findMany({
      where: { ownerOrganizationId: orgId },
      include: { versions: { include: { items: true }, orderBy: { versionNumber: 'desc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async createPriceBook(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const name = String(body.name ?? '').trim();
    const context = String(body.context ?? 'WORKSHOP_COST').trim().toUpperCase();
    if (!name) throw new BadRequestException('Vui lòng nhập tên bảng giá.');
    return this.prisma.priceBook.create({
      data: {
        stableKey: `${organizationId}:${context}:${randomUUID()}`,
        name,
        ownerOrganizationId: organizationId,
        currency: String(body.currency ?? 'VND'),
      },
    });
  }

  async createPriceBookVersion(user: JwtUser, priceBookId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const priceBook = await this.prisma.priceBook.findFirst({ where: { id: priceBookId, ownerOrganizationId: organizationId } });
    if (!priceBook) throw new NotFoundException('Không tìm thấy bảng giá trong tổ chức này.');
    const previousVersions = await this.prisma.priceBookVersion.findMany({ where: { priceBookId }, select: { versionNumber: true } });
    const versionNumber = nextPriceBookVersion(previousVersions.map((item) => item.versionNumber));
    const items = Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [];
    return this.prisma.priceBookVersion.create({
      data: {
        priceBookId,
        versionNumber,
        versionTag: String(body.versionTag ?? `v${versionNumber}`),
        validFrom: body.validFrom ? new Date(String(body.validFrom)) : undefined,
        validTo: body.validTo ? new Date(String(body.validTo)) : undefined,
        contentHash: String(body.contentHash ?? ''),
        items: {
          create: items.map((item) => ({
            itemType: String(item.category ?? item.itemType ?? 'OTHER').toUpperCase(),
            itemKey: String(item.itemKey ?? ''),
            supplierKey: item.supplierKey ? String(item.supplierKey) : undefined,
            customerTier: item.customerTier ? String(item.customerTier) : undefined,
            unit: String(item.unit ?? 'unit'),
            unitPrice: Number(item.unitPrice) || 0,
            attributes: { ...(item.attributes as Record<string, unknown> | undefined), context: String(item.context ?? 'WORKSHOP_COST') } as JsonInput,
          })),
        },
      },
      include: { items: true },
    });
  }

  async activatePriceBookVersion(user: JwtUser, versionId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const version = await this.prisma.priceBookVersion.findUnique({ where: { id: versionId }, include: { priceBook: true } });
    if (!version || version.priceBook.ownerOrganizationId !== organizationId) throw new NotFoundException('Không tìm thấy phiên bản bảng giá trong tổ chức này.');
    assertPriceBookVersionCanActivate(version);
    return this.prisma.$transaction(async (tx) => {
      await tx.priceBookVersion.updateMany({ where: { priceBookId: version.priceBookId, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } });
      const activated = await tx.priceBookVersion.update({ where: { id: version.id }, data: { status: 'ACTIVE', activatedAt: new Date() }, include: { items: true } });
      await tx.workshopAuditEvent.create({ data: this.auditData({ organizationId, entityType: 'PriceBookVersion', entityId: version.id, action: 'ACTIVATE', actorId: user.sub, fromStatus: version.status, toStatus: 'ACTIVE' }) });
      return activated;
    });
  }

  async quickQuotes(user: JwtUser, organizationId?: string) {
    const orgId = this.org(user, organizationId);
    return this.prisma.workshopQuickQuote.findMany({
      where: { organizationId: orgId },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, project: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createQuickQuote(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const rawLines = Array.isArray(body.lines) ? body.lines as Array<Record<string, unknown>> : [];
    const calculated = calculateQuickQuoteLines(rawLines.map((line) => ({
      lineType: String(line.lineType ?? 'MANUAL').toUpperCase(),
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      widthMm: line.widthMm === undefined ? undefined : Number(line.widthMm),
      heightMm: line.heightMm === undefined ? undefined : Number(line.heightMm),
    })));
    const subtotal = calculated.reduce((sum, line) => sum + line.total, 0);
    const discount = Math.max(0, Number(body.discount) || 0);
    const tax = Math.max(0, Number(body.tax) || 0);
    const total = Math.max(0, subtotal - discount + tax);
    const projectId = body.projectId ? String(body.projectId) : undefined;
    if (projectId) await this.project(projectId, organizationId);
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.workshopQuickQuote.create({
        data: {
          organizationId,
          code: this.code('QQ'),
          projectId,
          customerId: body.customerId ? String(body.customerId) : undefined,
          methodLabel: 'COMMERCIAL_ESTIMATE',
          currency: String(body.currency ?? 'VND'),
          priceBookVersionId: body.priceBookVersionId ? String(body.priceBookVersionId) : undefined,
          subtotal,
          discount,
          tax,
          total,
          note: String(body.note ?? ''),
          createdById: user.sub,
          lines: {
            create: calculated.map((line, index) => ({
              lineType: line.lineType,
              description: String(rawLines[index]?.description ?? ''),
              quantity: line.calculatedQuantity,
              unit: String(rawLines[index]?.unit ?? (line.lineType === 'AREA' ? 'm2' : 'unit')),
              unitPrice: line.unitPrice,
              total: line.total,
              metadata: {
                commercialEstimate: true,
                widthMm: line.widthMm,
                heightMm: line.heightMm,
              },
              sortOrder: index,
            })),
          },
        },
        include: { lines: true },
      });
      await tx.workshopActivity.create({
        data: { organizationId, projectId, customerId: quote.customerId, activityType: 'QUOTATION_CREATED', title: `Tạo báo giá nhanh ${quote.code}`, referenceType: 'QuickQuote', referenceId: quote.id, actorId: user.sub },
      });
      await tx.workshopDomainEventOutbox.create({ data: this.eventData(organizationId, 'QUOTATION_CREATED', 'QuickQuote', quote.id, { quickQuoteId: quote.id, projectId }) });
      return quote;
    });
  }

  async activities(user: JwtUser, query: { organizationId?: string; projectId?: string; customerId?: string }) {
    const organizationId = this.org(user, query.organizationId);
    return this.prisma.workshopActivity.findMany({
      where: { organizationId, projectId: query.projectId, customerId: query.customerId },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
  }

  async workOrders(user: JwtUser, query: { organizationId?: string; status?: string; assignedWorkerId?: string }) {
    const organizationId = this.org(user, query.organizationId);
    return this.prisma.workshopWorkOrder.findMany({
      where: {
        organizationId,
        status: query.status as WorkshopWorkOrderStatus | undefined,
        assignedWorkerId: query.assignedWorkerId,
      },
      include: { histories: { orderBy: { createdAt: 'desc' }, take: 10 }, project: { select: { id: true, code: true, name: true } } },
      orderBy: [{ priority: 'desc' }, { scheduledStart: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createWorkOrder(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const type = String(body.type ?? '') as WorkshopWorkOrderType;
    if (!Object.values(WorkshopWorkOrderType).includes(type)) throw new BadRequestException('Loại lệnh việc không hợp lệ.');
    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('Vui lòng nhập tên công việc.');
    const projectId = body.projectId ? String(body.projectId) : undefined;
    if (projectId) await this.project(projectId, organizationId);
    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workshopWorkOrder.create({
        data: {
          organizationId,
          code: String(body.code ?? '').trim() || this.code('WO'),
          type,
          title,
          projectId,
          openingId: body.openingId ? String(body.openingId) : undefined,
          assignedTeamId: body.assignedTeamId ? String(body.assignedTeamId) : undefined,
          assignedWorkerId: body.assignedWorkerId ? String(body.assignedWorkerId) : undefined,
          scheduledStart: body.scheduledStart ? new Date(String(body.scheduledStart)) : undefined,
          scheduledEnd: body.scheduledEnd ? new Date(String(body.scheduledEnd)) : undefined,
          sourceType: String(body.sourceType ?? 'MANUAL'),
          sourceId: body.sourceId ? String(body.sourceId) : undefined,
          instructions: String(body.instructions ?? ''),
          priority: Math.max(0, Math.round(Number(body.priority) || 0)),
          createdById: user.sub,
          histories: { create: { action: 'CREATE', toStatus: 'DRAFT', actorId: user.sub } },
        },
      });
      await tx.workshopDomainEventOutbox.create({ data: this.eventData(organizationId, 'WORK_ORDER_CREATED', 'WorkshopWorkOrder', workOrder.id, { workOrderId: workOrder.id, type }) });
      return workOrder;
    });
  }

  async transitionWorkOrder(user: JwtUser, workOrderId: string, action: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const normalizedAction = action.toUpperCase();
    const toStatus = WORK_ORDER_ACTION_STATUS[normalizedAction];
    if (!toStatus) throw new BadRequestException('Hành động lệnh việc không hợp lệ.');
    const workOrder = await this.prisma.workshopWorkOrder.findFirst({ where: { id: workOrderId, organizationId } });
    if (!workOrder) throw new NotFoundException('Không tìm thấy lệnh việc trong tổ chức này.');
    assertWorkOrderTransition(workOrder.status, toStatus);
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.workshopWorkOrder.update({
        where: { id: workOrder.id },
        data: {
          status: toStatus,
          startedAt: toStatus === 'IN_PROGRESS' && !workOrder.startedAt ? now : undefined,
          pausedAt: toStatus === 'PAUSED' ? now : toStatus === 'IN_PROGRESS' ? null : undefined,
          completedAt: toStatus === 'DONE' ? now : undefined,
        },
      });
      await tx.workshopWorkOrderHistory.create({
        data: {
          workOrderId: workOrder.id,
          action: normalizedAction,
          fromStatus: workOrder.status,
          toStatus,
          reason: String(body.reason ?? body.note ?? ''),
          actorId: user.sub,
          photoObjectIds: Array.isArray(body.photoObjectIds) ? body.photoObjectIds.map(String) : [],
        },
      });
      await tx.workshopAuditEvent.create({ data: this.auditData({ organizationId, entityType: 'WorkshopWorkOrder', entityId: workOrder.id, action: normalizedAction, actorId: user.sub, fromStatus: workOrder.status, toStatus, reason: String(body.reason ?? '') }) });
      if (toStatus === 'READY' || toStatus === 'DONE') {
        await tx.workshopDomainEventOutbox.create({ data: this.eventData(organizationId, toStatus === 'READY' ? 'WORK_ORDER_READY' : 'WORK_ORDER_COMPLETED', 'WorkshopWorkOrder', workOrder.id, { workOrderId: workOrder.id }) });
      }
      return updated;
    });
  }

  async reportWorkOrderIssue(user: JwtUser, workOrderId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const workOrder = await this.prisma.workshopWorkOrder.findFirst({ where: { id: workOrderId, organizationId } });
    if (!workOrder) throw new NotFoundException('Không tìm thấy lệnh việc trong tổ chức này.');
    const reason = String(body.reason ?? '').trim();
    if (!reason) throw new BadRequestException('Vui lòng mô tả sự cố.');
    return this.prisma.workshopWorkOrderHistory.create({
      data: {
        workOrderId,
        action: 'REPORT_ISSUE',
        fromStatus: workOrder.status,
        toStatus: workOrder.status,
        reason,
        actorId: user.sub,
        issueCode: body.issueCode ? String(body.issueCode) : 'OTHER',
        photoObjectIds: Array.isArray(body.photoObjectIds) ? body.photoObjectIds.map(String) : [],
      },
    });
  }

  // Sprint A4: QR, QC, installation, warranty, events, search and offline sync.
  private async entityOrganization(entityType: string, entityId: string): Promise<string> {
    if (entityType === 'PROJECT') return (await this.prisma.project.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    if (entityType === 'OPENING') return (await this.prisma.workshopOpening.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    if (entityType === 'WORK_ORDER') return (await this.prisma.workshopWorkOrder.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    if (entityType === 'STOCK_LOT') return (await this.prisma.workshopStockLot.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    if (entityType === 'STOCK_REMNANT') return (await this.prisma.workshopStockRemnant.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    if (entityType === 'PACKAGE') return (await this.prisma.workshopPackage.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    if (entityType === 'WARRANTY_ASSET') return (await this.prisma.workshopWarrantyAsset.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    throw new BadRequestException('Loại thực thể QR không được hỗ trợ.');
  }

  async issueQr(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const entityType = String(body.entityType ?? '').trim().toUpperCase();
    const entityId = String(body.entityId ?? '').trim();
    if (!entityType || !entityId) throw new BadRequestException('Thiếu loại hoặc ID thực thể QR.');
    const actualOrganizationId = await this.entityOrganization(entityType, entityId);
    assertQrEntityAuthorized(actualOrganizationId, organizationId);
    return this.prisma.workshopQrIdentity.upsert({
      where: { organizationId_entityType_entityId: { organizationId, entityType, entityId } },
      create: { organizationId, publicId: randomUUID(), entityType, entityId, createdById: user.sub },
      update: { active: true },
    });
  }

  async resolveQr(user: JwtUser, publicId: string, requestedOrganizationId?: string) {
    const organizationId = this.org(user, requestedOrganizationId);
    const identity = await this.prisma.workshopQrIdentity.findUnique({ where: { publicId } });
    if (!identity || !identity.active) throw new NotFoundException('Mã QR không tồn tại hoặc đã ngừng sử dụng.');
    assertQrEntityAuthorized(identity.organizationId, organizationId);
    return { entityType: identity.entityType, entityId: identity.entityId, route: `/workshop/${identity.entityType.toLowerCase()}/${identity.entityId}` };
  }

  async createPackage(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    return this.prisma.workshopPackage.create({
      data: {
        organizationId,
        code: String(body.code ?? '').trim() || this.code('PKG'),
        projectId: body.projectId ? String(body.projectId) : undefined,
        workOrderId: body.workOrderId ? String(body.workOrderId) : undefined,
        itemRefs: body.itemRefs as JsonInput | undefined,
        createdById: user.sub,
      },
    });
  }

  async qcTemplates(user: JwtUser, organizationId?: string) {
    const orgId = this.org(user, organizationId);
    return this.prisma.workshopQcTemplate.findMany({ where: { organizationId: orgId, active: true }, include: { items: { orderBy: { sortOrder: 'asc' } } }, orderBy: { name: 'asc' } });
  }

  async createQcTemplate(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const name = String(body.name ?? '').trim();
    const items = Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [];
    if (!name || !items.length) throw new BadRequestException('Mẫu QC cần tên và ít nhất một tiêu chí.');
    return this.prisma.workshopQcTemplate.create({
      data: {
        organizationId,
        code: String(body.code ?? '').trim() || this.code('QC'),
        name,
        appliesTo: String(body.appliesTo ?? 'WORK_ORDER'),
        version: Math.max(1, Math.round(Number(body.version) || 1)),
        items: {
          create: items.map((item, index) => ({
            checkKey: String(item.checkKey ?? `CHECK_${index + 1}`),
            label: String(item.label ?? ''),
            required: item.required !== false,
            instructions: String(item.instructions ?? ''),
            sortOrder: index,
          })),
        },
      },
      include: { items: true },
    });
  }

  async createQcInspection(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.access.assert(user, organizationId, 'qc.execute');
    const templateId = String(body.templateId ?? '');
    const template = await this.prisma.workshopQcTemplate.findFirst({ where: { id: templateId, organizationId, active: true }, include: { items: true } });
    if (!template) throw new NotFoundException('Không tìm thấy mẫu QC trong tổ chức này.');
    return this.prisma.workshopQcInspection.create({
      data: {
        organizationId,
        templateId,
        workOrderId: body.workOrderId ? String(body.workOrderId) : undefined,
        installationId: body.installationId ? String(body.installationId) : undefined,
        entityType: String(body.entityType ?? template.appliesTo),
        entityId: String(body.entityId ?? body.workOrderId ?? body.installationId ?? ''),
        status: 'IN_PROGRESS',
        createdById: user.sub,
        results: {
          create: template.items.map((item) => ({ checkKey: item.checkKey, label: item.label, result: 'REWORK' })),
        },
      },
      include: { results: true },
    });
  }

  async completeQcInspection(user: JwtUser, inspectionId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.access.assert(user, organizationId, 'qc.execute');
    const inspection = await this.prisma.workshopQcInspection.findFirst({ where: { id: inspectionId, organizationId } });
    if (!inspection) throw new NotFoundException('Không tìm thấy phiếu QC trong tổ chức này.');
    if (inspection.status === 'COMPLETED') throw new ConflictException('Phiếu QC đã hoàn tất.');
    const template = await this.prisma.workshopQcTemplate.findFirst({
      where: { id: inspection.templateId, organizationId },
      include: { items: true },
    });
    if (!template) throw new NotFoundException('Không tìm thấy mẫu QC của phiếu kiểm tra này.');
    const results = Array.isArray(body.results) ? body.results as Array<Record<string, unknown>> : [];
    assertQcCompletion(results.map((item) => ({ result: String(item.result ?? '') })));
    assertQcRequiredChecks(
      template.items.filter((item) => item.required).map((item) => item.checkKey),
      results.map((item) => ({ checkKey: String(item.checkKey ?? ''), result: String(item.result ?? '') })),
    );
    const inspectionPhotoObjectIds = Array.isArray(body.photoObjectIds) ? body.photoObjectIds.map(String) : [];
    assertQcFailureEvidence(
      results.map((item) => ({ result: String(item.result ?? ''), photoObjectIds: Array.isArray(item.photoObjectIds) ? item.photoObjectIds.map(String) : [] })),
      inspectionPhotoObjectIds,
    );
    const overall = results.some((item) => item.result === 'FAIL') ? WorkshopQcResult.FAIL : results.some((item) => item.result === 'REWORK') ? WorkshopQcResult.REWORK : WorkshopQcResult.PASS;
    return this.prisma.$transaction(async (tx) => {
      for (const item of results) {
        await tx.workshopQcInspectionResult.upsert({
          where: { inspectionId_checkKey: { inspectionId, checkKey: String(item.checkKey) } },
          create: { inspectionId, checkKey: String(item.checkKey), label: String(item.label ?? item.checkKey), result: String(item.result) as WorkshopQcResult, note: String(item.note ?? ''), photoObjectIds: Array.isArray(item.photoObjectIds) ? item.photoObjectIds.map(String) : [] },
          update: { result: String(item.result) as WorkshopQcResult, note: String(item.note ?? ''), photoObjectIds: Array.isArray(item.photoObjectIds) ? item.photoObjectIds.map(String) : [] },
        });
      }
      const updated = await tx.workshopQcInspection.update({
        where: { id: inspectionId },
        data: { status: 'COMPLETED', overallResult: overall, reviewerId: user.sub, reviewedAt: new Date(), note: String(body.note ?? ''), photoObjectIds: inspectionPhotoObjectIds },
        include: { results: true },
      });
      await tx.workshopAuditEvent.create({ data: this.auditData({ organizationId, entityType: 'QcInspection', entityId: inspectionId, action: 'COMPLETE', actorId: user.sub, fromStatus: inspection.status, toStatus: `COMPLETED:${overall}` }) });
      if (inspection.workOrderId && overall !== WorkshopQcResult.PASS) {
        const workOrder = await tx.workshopWorkOrder.findFirst({ where: { id: inspection.workOrderId, organizationId } });
        if (workOrder) {
          await tx.workshopWorkOrderHistory.create({
            data: {
              workOrderId: workOrder.id,
              action: 'QC_REWORK_REQUIRED',
              fromStatus: workOrder.status,
              toStatus: workOrder.status,
              reason: String(body.note ?? `QC ${overall}`),
              actorId: user.sub,
              issueCode: 'QC_REWORK',
              photoObjectIds: Array.isArray(body.photoObjectIds) ? body.photoObjectIds.map(String) : [],
            },
          });
          await tx.workshopDomainEventOutbox.create({ data: this.eventData(organizationId, 'QC_REWORK_REQUIRED', 'WorkshopWorkOrder', workOrder.id, { workOrderId: workOrder.id, inspectionId, overall }) });
        }
      }
      await tx.workshopTelemetryEvent.create({ data: { organizationId, actorId: user.sub, eventType: overall === WorkshopQcResult.PASS ? 'QC_COMPLETED' : 'QC_REWORK', entityType: 'QC_INSPECTION', entityId: inspectionId, success: overall === WorkshopQcResult.PASS } });
      return updated;
    });
  }

  async installations(user: JwtUser, organizationId?: string) {
    const orgId = this.org(user, organizationId);
    const jobs = await this.prisma.workshopInstallationJob.findMany({ where: { organizationId: orgId }, include: { project: { select: { id: true, code: true, name: true, address: true } } }, orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'desc' }] });
    const teamIds = [...new Set(jobs.map((job) => job.teamId).filter((id): id is string => Boolean(id)))];
    const teams = teamIds.length
      ? await this.prisma.workshopTeam.findMany({ where: { organizationId: orgId, id: { in: teamIds } }, include: { members: { where: { leftAt: null } } } })
      : [];
    const workerIds = [...new Set(teams.flatMap((team) => team.members.map((member) => member.workerId)))];
    const workers = workerIds.length ? await this.prisma.workshopWorker.findMany({ where: { organizationId: orgId, id: { in: workerIds } } }) : [];
    const workerById = new Map(workers.map((worker) => [worker.id, worker]));
    const teamById = new Map(teams.map((team) => [team.id, { ...team, members: team.members.flatMap((member) => {
      const worker = workerById.get(member.workerId);
      return worker ? [{ ...member, worker }] : [];
    }) }]));
    return jobs.map((job) => ({ ...job, assignedTeam: job.teamId ? teamById.get(job.teamId) ?? null : null }));
  }

  async createInstallation(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.access.assert(user, organizationId, 'installation.manage');
    const projectId = String(body.projectId ?? '');
    await this.project(projectId, organizationId);
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.workshopInstallationJob.create({
        data: {
          organizationId,
          code: String(body.code ?? '').trim() || this.code('INSTALL'),
          projectId,
          teamId: body.teamId ? String(body.teamId) : undefined,
          vehicleRef: String(body.vehicleRef ?? ''),
          scheduledStart: body.scheduledStart ? new Date(String(body.scheduledStart)) : undefined,
          scheduledEnd: body.scheduledEnd ? new Date(String(body.scheduledEnd)) : undefined,
          openingIds: Array.isArray(body.openingIds) ? body.openingIds.map(String) : [],
          materialsChecklist: body.materialsChecklist as JsonInput | undefined,
          toolsChecklist: body.toolsChecklist as JsonInput | undefined,
          requiredQcTemplateId: body.requiredQcTemplateId ? String(body.requiredQcTemplateId) : undefined,
          requiredPhotoCount: Math.max(0, Math.round(Number(body.requiredPhotoCount) || 1)),
          requiresCustomerSignature: body.requiresCustomerSignature !== false,
          customerName: String(body.customerName ?? ''),
          note: String(body.note ?? ''),
          createdById: user.sub,
        },
      });
      await tx.workshopDomainEventOutbox.create({ data: this.eventData(organizationId, 'INSTALLATION_CREATED', 'InstallationJob', job.id, { installationId: job.id, projectId }) });
      return job;
    });
  }

  async transitionInstallation(user: JwtUser, installationId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.access.assert(user, organizationId, 'installation.execute');
    const toStatus = String(body.status ?? '') as WorkshopInstallationStatus;
    const job = await this.prisma.workshopInstallationJob.findFirst({ where: { id: installationId, organizationId } });
    if (!job) throw new NotFoundException('Không tìm thấy công việc lắp đặt trong tổ chức này.');
    assertInstallationTransition(job.status, toStatus);
    const mergedPhotoIds = Array.isArray(body.photoObjectIds) ? body.photoObjectIds.map(String) : job.photoObjectIds;
    const mergedSignatureId = body.customerSignatureObjectId ? String(body.customerSignatureObjectId) : job.customerSignatureObjectId;
    const materialsChecklist = body.materialsChecklist === undefined ? job.materialsChecklist : body.materialsChecklist;
    const toolsChecklist = body.toolsChecklist === undefined ? job.toolsChecklist : body.toolsChecklist;
    if (toStatus === 'COMPLETED') {
      const qcPassed = job.requiredQcTemplateId
        ? Boolean(await this.prisma.workshopQcInspection.findFirst({ where: { organizationId, installationId: job.id, templateId: job.requiredQcTemplateId, status: 'COMPLETED', overallResult: 'PASS' } }))
        : true;
      assertInstallationCanComplete({
        ...job,
        customerSignatureObjectId: mergedSignatureId,
        photoObjectIds: mergedPhotoIds,
        qcPassed,
        materialsChecklistComplete: installationChecklistComplete(materialsChecklist),
        toolsChecklistComplete: installationChecklistComplete(toolsChecklist),
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.workshopInstallationJob.update({
        where: { id: job.id },
        data: {
          status: toStatus,
          arrivedAt: toStatus === 'ON_SITE' ? now : undefined,
          startedAt: toStatus === 'IN_PROGRESS' && !job.startedAt ? now : undefined,
          acceptedAt: toStatus === 'ACCEPTED' ? now : undefined,
          completedAt: toStatus === 'COMPLETED' ? now : undefined,
          customerSignatureObjectId: body.customerSignatureObjectId ? String(body.customerSignatureObjectId) : undefined,
          photoObjectIds: Array.isArray(body.photoObjectIds) ? body.photoObjectIds.map(String) : undefined,
          materialsChecklist: body.materialsChecklist === undefined ? undefined : body.materialsChecklist as JsonInput,
          toolsChecklist: body.toolsChecklist === undefined ? undefined : body.toolsChecklist as JsonInput,
          note: body.note === undefined ? undefined : String(body.note),
        },
      });
      await tx.workshopAuditEvent.create({ data: this.auditData({ organizationId, entityType: 'InstallationJob', entityId: job.id, action: 'TRANSITION', actorId: user.sub, fromStatus: job.status, toStatus }) });
      if (toStatus === 'SCHEDULED' || toStatus === 'COMPLETED') {
        await tx.workshopDomainEventOutbox.create({ data: this.eventData(organizationId, toStatus === 'SCHEDULED' ? 'INSTALLATION_SCHEDULED' : 'INSTALLATION_COMPLETED', 'InstallationJob', job.id, { installationId: job.id, projectId: job.projectId }) });
      }
      if (toStatus === 'COMPLETED') await tx.workshopTelemetryEvent.create({ data: { organizationId, actorId: user.sub, eventType: 'INSTALLATION_COMPLETED', entityType: 'INSTALLATION', entityId: job.id } });
      return updated;
    });
  }

  async warrantyAssets(user: JwtUser, organizationId?: string) {
    const orgId = this.org(user, organizationId);
    return this.prisma.workshopWarrantyAsset.findMany({ where: { organizationId: orgId }, include: { tickets: { include: { serviceHistory: { orderBy: { occurredAt: 'desc' } } }, orderBy: { createdAt: 'desc' } }, project: { select: { id: true, code: true, name: true } } }, orderBy: { installedAt: 'desc' } });
  }

  async createWarrantyAsset(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const projectId = String(body.projectId ?? '');
    await this.project(projectId, organizationId);
    const installedAt = body.installedAt ? new Date(String(body.installedAt)) : new Date();
    const warrantyMonths = Math.max(1, Math.round(Number(body.warrantyMonths) || 12));
    const expiresAt = new Date(installedAt);
    expiresAt.setMonth(expiresAt.getMonth() + warrantyMonths);
    return this.prisma.workshopWarrantyAsset.create({
      data: {
        organizationId,
        assetCode: String(body.assetCode ?? '').trim() || this.code('WA'),
        projectId,
        openingId: body.openingId ? String(body.openingId) : undefined,
        installationJobId: body.installationJobId ? String(body.installationJobId) : undefined,
        installedAt,
        installerTeamId: body.installerTeamId ? String(body.installerTeamId) : undefined,
        warrantyMonths,
        expiresAt,
        manufacturingBomRevisionId: body.manufacturingBomRevisionId ? String(body.manufacturingBomRevisionId) : undefined,
        metadata: body.metadata as JsonInput | undefined,
      },
    });
  }

  async createWarrantyTicket(user: JwtUser, assetId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.access.assert(user, organizationId, 'warranty.execute');
    const asset = await this.prisma.workshopWarrantyAsset.findFirst({ where: { id: assetId, organizationId } });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản bảo hành trong tổ chức này.');
    const description = String(body.description ?? '').trim();
    if (!description) throw new BadRequestException('Vui lòng mô tả yêu cầu bảo hành.');
    if (body.assignedTechnicianId) {
      const technician = await this.prisma.user.findFirst({ where: { id: String(body.assignedTechnicianId), organizationId } });
      if (!technician) throw new BadRequestException('Kỹ thuật viên không thuộc cơ sở sản xuất này.');
    }
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.workshopWarrantyTicket.create({
        data: {
          organizationId,
          code: this.code('WT'),
          assetId,
          issueType: String(body.issueType ?? 'OTHER'),
          description,
          photoObjectIds: Array.isArray(body.photoObjectIds) ? body.photoObjectIds.map(String) : [],
          requestedById: user.sub,
          assignedTeamId: body.assignedTeamId ? String(body.assignedTeamId) : undefined,
          assignedTechnicianId: body.assignedTechnicianId ? String(body.assignedTechnicianId) : undefined,
        },
      });
      await tx.workshopDomainEventOutbox.create({ data: this.eventData(organizationId, 'WARRANTY_REQUESTED', 'WarrantyTicket', ticket.id, { ticketId: ticket.id, assetId }) });
      return ticket;
    });
  }

  async addWarrantyServiceEvent(user: JwtUser, ticketId: string, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    await this.access.assert(user, organizationId, 'warranty.execute');
    const ticket = await this.prisma.workshopWarrantyTicket.findFirst({ where: { id: ticketId, organizationId } });
    if (!ticket) throw new NotFoundException('Không tìm thấy phiếu bảo hành trong tổ chức này.');
    const status = body.status ? String(body.status) : undefined;
    if (status) assertWarrantyTransition(ticket.status, status, String(body.resolution ?? ticket.resolution));
    if (body.assignedTechnicianId) {
      const technician = await this.prisma.user.findFirst({ where: { id: String(body.assignedTechnicianId), organizationId } });
      if (!technician) throw new BadRequestException('Kỹ thuật viên không thuộc cơ sở sản xuất này.');
    }
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.workshopWarrantyServiceEvent.create({
        data: { ticketId, action: String(body.action ?? 'NOTE'), note: String(body.note ?? ''), parts: body.parts as JsonInput | undefined, photoObjectIds: Array.isArray(body.photoObjectIds) ? body.photoObjectIds.map(String) : [], actorId: user.sub },
      });
      if (body.status || body.assignedTeamId || body.assignedTechnicianId || body.resolution) {
        await tx.workshopWarrantyTicket.update({
          where: { id: ticketId },
          data: {
            status: status as never,
            assignedTeamId: body.assignedTeamId ? String(body.assignedTeamId) : undefined,
            assignedTechnicianId: body.assignedTechnicianId ? String(body.assignedTechnicianId) : undefined,
            resolution: body.resolution === undefined ? undefined : String(body.resolution),
            resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : undefined,
            closedAt: status === 'CLOSED' ? new Date() : undefined,
          },
        });
      }
      if (String(body.status) === 'CLOSED') await tx.workshopTelemetryEvent.create({ data: { organizationId, actorId: user.sub, eventType: 'WARRANTY_CLOSED', entityType: 'WARRANTY_TICKET', entityId: ticketId } });
      return event;
    });
  }

  async globalSearch(user: JwtUser, term: string, requestedOrganizationId?: string) {
    const organizationId = this.org(user, requestedOrganizationId);
    const q = term.trim();
    if (q.length < 2) return { customers: [], projects: [], openings: [], workOrders: [], stockItems: [], warranties: [] };
    const [customers, projects, openings, workOrders, stockItems, warranties] = await Promise.all([
      this.prisma.workshopCustomer.findMany({ where: { organizationId, OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { code: { contains: q, mode: 'insensitive' } }] }, take: 10 }),
      this.prisma.project.findMany({ where: { organizationId, OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }, { customerPhone: { contains: q } }] }, take: 10 }),
      this.prisma.workshopOpening.findMany({ where: { organizationId, OR: [{ stableCode: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }, take: 10 }),
      this.prisma.workshopWorkOrder.findMany({ where: { organizationId, OR: [{ code: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }] }, take: 10 }),
      this.prisma.workshopStockItem.findMany({ where: { organizationId, OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] }, take: 10 }),
      this.prisma.workshopWarrantyAsset.findMany({ where: { organizationId, assetCode: { contains: q, mode: 'insensitive' } }, take: 10 }),
    ]);
    return { customers, projects, openings, workOrders, stockItems, warranties };
  }

  async dashboard(user: JwtUser, requestedOrganizationId?: string) {
    const organizationId = this.org(user, requestedOrganizationId);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86_400_000);
    const [newQuotes, openOrders, workOrdersToday, inProduction, installationsToday, warrantyTickets, pendingEvents] = await Promise.all([
      this.prisma.workshopQuickQuote.count({ where: { organizationId, status: 'DRAFT' } }),
      this.prisma.order.count({ where: { factoryOrgId: organizationId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      this.prisma.workshopWorkOrder.count({ where: { organizationId, scheduledStart: { gte: start, lt: end } } }),
      this.prisma.workshopWorkOrder.count({ where: { organizationId, status: { in: ['READY', 'IN_PROGRESS', 'PAUSED'] } } }),
      this.prisma.workshopInstallationJob.count({ where: { organizationId, scheduledStart: { gte: start, lt: end } } }),
      this.prisma.workshopWarrantyTicket.count({ where: { organizationId, status: { in: ['OPEN', 'SCHEDULED', 'IN_PROGRESS'] } } }),
      this.prisma.workshopDomainEventOutbox.count({ where: { organizationId, status: 'PENDING' } }),
    ]);
    return { newQuotes, openOrders, workOrdersToday, inProduction, installationsToday, warrantyTickets, pendingEvents };
  }

  async applyOfflineMutation(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.org(user, body.organizationId as string | undefined);
    const clientMutationId = String(body.clientMutationId ?? '').trim();
    const deviceId = String(body.deviceId ?? '').trim();
    const entityType = String(body.entityType ?? '').trim().toUpperCase();
    const operation = String(body.operation ?? '').trim().toUpperCase();
    if (!clientMutationId || !deviceId || !entityType || !operation) throw new BadRequestException('Mutation offline thiếu định danh bắt buộc.');
    const existing = await this.prisma.workshopOfflineMutation.findUnique({ where: { organizationId_clientMutationId: { organizationId, clientMutationId } } });
    if (existing) return existing;
    const payload = (body.payload ?? {}) as Record<string, unknown>;
    if (entityType === 'QC_INSPECTION') await this.access.assert(user, organizationId, 'qc.execute');
    if (entityType === 'INSTALLATION') await this.access.assert(user, organizationId, 'installation.execute');
    if (entityType === 'WARRANTY_ASSET' || entityType === 'WARRANTY_TICKET') await this.access.assert(user, organizationId, 'warranty.execute');
    let serverRevision = 0;
    if (entityType === 'OPENING' && body.entityId) {
      const opening = await this.prisma.workshopOpening.findFirst({ where: { id: String(body.entityId), organizationId } });
      if (!opening) throw new NotFoundException('Không tìm thấy ô chờ để đồng bộ.');
      serverRevision = opening.revision;
    }
    const decision = resolveOfflineMutation(serverRevision, body.baseRevision === undefined ? undefined : Number(body.baseRevision));
    if (decision === 'CONFLICT') {
      return this.prisma.workshopOfflineMutation.create({
        data: { organizationId, clientMutationId, deviceId, entityType, entityId: body.entityId ? String(body.entityId) : undefined, operation, baseRevision: Number(body.baseRevision), payload: payload as JsonInput, status: 'CONFLICT', conflict: { serverRevision }, actorId: user.sub },
      });
    }
    return this.prisma.$transaction(async (tx) => {
      let result: JsonInput = { accepted: true };
      if (entityType === 'SITE_NOTE' && operation === 'CREATE') {
        const projectId = String(payload.projectId ?? '');
        const project = await tx.project.findFirst({ where: { id: projectId, organizationId } });
        if (!project) throw new NotFoundException('Không tìm thấy công trình để đồng bộ ghi chú.');
        const note = await tx.workshopSiteNote.create({ data: { organizationId, projectId, openingId: payload.openingId ? String(payload.openingId) : undefined, noteType: String(payload.noteType ?? 'TEXT'), content: String(payload.content ?? ''), createdById: user.sub } });
        result = { entityId: note.id };
      } else if (entityType === 'PROJECT' && operation === 'CREATE') {
        const project = await tx.project.create({
          data: {
            code: this.code('CT'),
            name: String(payload.name ?? 'Công trình mới'),
            organizationId,
            ownerId: user.sub,
            customerName: String(payload.customerName ?? ''),
            customerPhone: String(payload.customerPhone ?? ''),
            address: String(payload.address ?? ''),
            note: String(payload.note ?? ''),
          },
        });
        result = { entityId: project.id, code: project.code };
      } else if (entityType === 'PROJECT' && operation === 'UPDATE') {
        const projectId = String(body.entityId ?? '');
        const project = await tx.project.findFirst({ where: { id: projectId, organizationId } });
        if (!project) throw new NotFoundException('Không tìm thấy công trình để đồng bộ.');
        const allowed = ['name', 'customerName', 'customerPhone', 'address', 'status', 'estimatedValue', 'incurredValue', 'incurredType', 'settledValue', 'note', 'images', 'scale', 'productsUsed'];
        const data: Record<string, unknown> = {};
        for (const key of allowed) if (payload[key] !== undefined) data[key] = payload[key];
        await tx.project.update({ where: { id: projectId }, data });
        result = { entityId: projectId };
      } else if (entityType === 'PROJECT' && operation === 'DELETE') {
        const projectId = String(body.entityId ?? '');
        const project = await tx.project.findFirst({ where: { id: projectId, organizationId } });
        if (!project) throw new NotFoundException('Không tìm thấy công trình để đồng bộ.');
        const dependencies = await tx.workshopInstallationJob.count({ where: { projectId, organizationId } });
        if (dependencies) throw new ConflictException('Không thể xóa công trình đã có lịch lắp đặt.');
        await tx.project.delete({ where: { id: projectId } });
        result = { entityId: projectId, deleted: true };
      } else if (entityType === 'OPENING' && operation === 'CREATE') {
        const projectId = String(payload.projectId ?? '');
        const project = await tx.project.findFirst({ where: { id: projectId, organizationId } });
        if (!project) throw new NotFoundException('Không tìm thấy công trình để đồng bộ ô chờ.');
        const widthMm = payload.widthMm === undefined ? undefined : Math.round(Number(payload.widthMm));
        const heightMm = payload.heightMm === undefined ? undefined : Math.round(Number(payload.heightMm));
        const opening = await tx.workshopOpening.create({
          data: {
            organizationId,
            projectId,
            zoneId: payload.zoneId ? String(payload.zoneId) : undefined,
            stableCode: String(payload.stableCode ?? '').trim() || this.code('OPEN'),
            description: String(payload.description ?? ''),
            widthMm,
            heightMm,
            measurementStatus: widthMm && heightMm ? 'MEASURED' : 'DRAFT',
            installationNotes: String(payload.installationNotes ?? ''),
            createdById: user.sub,
            ...(payload.intentType ? { doorRequest: { create: { organizationId, intentType: String(payload.intentType), operationType: String(payload.operationType ?? ''), note: String(payload.note ?? '') } } } : {}),
          },
        });
        if (widthMm && heightMm) await tx.openingMeasurement.create({ data: { organizationId, openingId: opening.id, revision: 1, widthMm, heightMm, status: 'MEASURED', measuredById: user.sub } });
        result = { entityId: opening.id, stableCode: opening.stableCode };
      } else if (entityType === 'OPENING' && operation === 'MEASURE') {
        const openingId = String(body.entityId);
        const opening = await tx.workshopOpening.findFirst({ where: { id: openingId, organizationId } });
        if (!opening) throw new NotFoundException('Không tìm thấy ô chờ để đồng bộ số đo.');
        const revision = opening.revision + 1;
        const widthMm = Math.round(Number(payload.widthMm));
        const heightMm = Math.round(Number(payload.heightMm));
        if (!(widthMm > 0) || !(heightMm > 0)) throw new BadRequestException('Số đo offline không hợp lệ.');
        const measurement = await tx.openingMeasurement.create({ data: { organizationId, openingId, revision, widthMm, heightMm, status: 'MEASURED', note: String(payload.note ?? ''), measuredById: user.sub } });
        await tx.workshopOpening.update({ where: { id: openingId }, data: { widthMm, heightMm, revision, measurementStatus: 'MEASURED' } });
        result = { entityId: measurement.id, revision };
      } else if (entityType === 'QC_INSPECTION' && operation === 'COMPLETE') {
        const inspectionId = String(body.entityId ?? '');
        const inspection = await tx.workshopQcInspection.findFirst({ where: { id: inspectionId, organizationId } });
        if (!inspection) throw new NotFoundException('Không tìm thấy phiếu QC để đồng bộ.');
        if (inspection.status === 'COMPLETED') {
          result = { entityId: inspectionId, alreadyApplied: true };
        } else {
          const template = await tx.workshopQcTemplate.findFirst({ where: { id: inspection.templateId, organizationId }, include: { items: true } });
          if (!template) throw new NotFoundException('Không tìm thấy mẫu QC để đồng bộ.');
          const qcResults = Array.isArray(payload.results) ? payload.results as Array<Record<string, unknown>> : [];
          assertQcCompletion(qcResults.map((item) => ({ result: String(item.result ?? '') })));
          assertQcRequiredChecks(template.items.filter((item) => item.required).map((item) => item.checkKey), qcResults.map((item) => ({ checkKey: String(item.checkKey ?? ''), result: String(item.result ?? '') })));
          const qcPhotoObjectIds = Array.isArray(payload.photoObjectIds) ? payload.photoObjectIds.map(String) : [];
          assertQcFailureEvidence(
            qcResults.map((item) => ({ result: String(item.result ?? ''), photoObjectIds: Array.isArray(item.photoObjectIds) ? item.photoObjectIds.map(String) : [] })),
            qcPhotoObjectIds,
          );
          const overall = qcResults.some((item) => item.result === 'FAIL') ? WorkshopQcResult.FAIL : qcResults.some((item) => item.result === 'REWORK') ? WorkshopQcResult.REWORK : WorkshopQcResult.PASS;
          for (const item of qcResults) {
            await tx.workshopQcInspectionResult.upsert({
              where: { inspectionId_checkKey: { inspectionId, checkKey: String(item.checkKey) } },
              create: { inspectionId, checkKey: String(item.checkKey), label: String(item.label ?? item.checkKey), result: String(item.result) as WorkshopQcResult, note: String(item.note ?? ''), photoObjectIds: Array.isArray(item.photoObjectIds) ? item.photoObjectIds.map(String) : [] },
              update: { result: String(item.result) as WorkshopQcResult, note: String(item.note ?? ''), photoObjectIds: Array.isArray(item.photoObjectIds) ? item.photoObjectIds.map(String) : [] },
            });
          }
          await tx.workshopQcInspection.update({ where: { id: inspectionId }, data: { status: 'COMPLETED', overallResult: overall, reviewerId: user.sub, reviewedAt: new Date(), note: String(payload.note ?? ''), photoObjectIds: qcPhotoObjectIds } });
          if (inspection.workOrderId && overall !== WorkshopQcResult.PASS) {
            const order = await tx.workshopWorkOrder.findFirst({ where: { id: inspection.workOrderId, organizationId } });
            if (order) await tx.workshopWorkOrderHistory.create({ data: { workOrderId: order.id, action: 'QC_REWORK_REQUIRED', fromStatus: order.status, toStatus: order.status, reason: String(payload.note ?? `QC ${overall}`), actorId: user.sub, issueCode: 'QC_REWORK' } });
          }
          result = { entityId: inspectionId, overall };
        }
      } else if (entityType === 'INSTALLATION' && operation === 'STATUS') {
        const installationId = String(body.entityId ?? '');
        const job = await tx.workshopInstallationJob.findFirst({ where: { id: installationId, organizationId } });
        if (!job) throw new NotFoundException('Không tìm thấy công việc lắp đặt để đồng bộ.');
        const toStatus = String(payload.status ?? '') as WorkshopInstallationStatus;
        if (job.status !== toStatus) assertInstallationTransition(job.status, toStatus);
        const photoObjectIds = Array.isArray(payload.photoObjectIds) ? payload.photoObjectIds.map(String) : job.photoObjectIds;
        const signature = payload.customerSignatureObjectId ? String(payload.customerSignatureObjectId) : job.customerSignatureObjectId;
        const materialsChecklist = payload.materialsChecklist === undefined ? job.materialsChecklist : payload.materialsChecklist;
        const toolsChecklist = payload.toolsChecklist === undefined ? job.toolsChecklist : payload.toolsChecklist;
        if (toStatus === 'COMPLETED') {
          const qcPassed = job.requiredQcTemplateId ? Boolean(await tx.workshopQcInspection.findFirst({ where: { organizationId, installationId, templateId: job.requiredQcTemplateId, status: 'COMPLETED', overallResult: 'PASS' } })) : true;
          assertInstallationCanComplete({ ...job, customerSignatureObjectId: signature, photoObjectIds, qcPassed, materialsChecklistComplete: installationChecklistComplete(materialsChecklist), toolsChecklistComplete: installationChecklistComplete(toolsChecklist) });
        }
        const now = new Date();
        await tx.workshopInstallationJob.update({ where: { id: installationId }, data: { status: toStatus, arrivedAt: toStatus === 'ON_SITE' ? now : undefined, startedAt: toStatus === 'IN_PROGRESS' && !job.startedAt ? now : undefined, acceptedAt: toStatus === 'ACCEPTED' ? now : undefined, completedAt: toStatus === 'COMPLETED' ? now : undefined, customerSignatureObjectId: signature ?? undefined, photoObjectIds, materialsChecklist: payload.materialsChecklist === undefined ? undefined : payload.materialsChecklist as JsonInput, toolsChecklist: payload.toolsChecklist === undefined ? undefined : payload.toolsChecklist as JsonInput, note: payload.note === undefined ? undefined : String(payload.note) } });
        result = { entityId: installationId, status: toStatus };
      } else if (entityType === 'WARRANTY_ASSET' && operation === 'CREATE_TICKET') {
        const assetId = String(body.entityId ?? '');
        const asset = await tx.workshopWarrantyAsset.findFirst({ where: { id: assetId, organizationId } });
        if (!asset) throw new NotFoundException('Không tìm thấy tài sản bảo hành để đồng bộ.');
        const description = String(payload.description ?? '').trim();
        if (!description) throw new BadRequestException('Yêu cầu bảo hành thiếu mô tả.');
        const ticket = await tx.workshopWarrantyTicket.create({ data: { organizationId, code: this.code('WT'), assetId, issueType: String(payload.issueType ?? 'OTHER'), description, photoObjectIds: Array.isArray(payload.photoObjectIds) ? payload.photoObjectIds.map(String) : [], requestedById: user.sub } });
        await tx.workshopDomainEventOutbox.create({ data: this.eventData(organizationId, 'WARRANTY_REQUESTED', 'WarrantyTicket', ticket.id, { ticketId: ticket.id, assetId }) });
        result = { entityId: ticket.id, code: ticket.code };
      } else if (entityType === 'WARRANTY_TICKET' && operation === 'SERVICE_EVENT') {
        const ticketId = String(body.entityId ?? '');
        const ticket = await tx.workshopWarrantyTicket.findFirst({ where: { id: ticketId, organizationId } });
        if (!ticket) throw new NotFoundException('Không tìm thấy phiếu bảo hành để đồng bộ.');
        const status = payload.status ? String(payload.status) : undefined;
        if (status) assertWarrantyTransition(ticket.status, status, String(payload.resolution ?? ticket.resolution));
        if (payload.assignedTechnicianId) {
          const technician = await tx.user.findFirst({ where: { id: String(payload.assignedTechnicianId), organizationId } });
          if (!technician) throw new BadRequestException('Kỹ thuật viên không thuộc cơ sở sản xuất này.');
        }
        const event = await tx.workshopWarrantyServiceEvent.create({ data: { ticketId, action: String(payload.action ?? 'NOTE'), note: String(payload.note ?? ''), parts: payload.parts as JsonInput | undefined, photoObjectIds: Array.isArray(payload.photoObjectIds) ? payload.photoObjectIds.map(String) : [], actorId: user.sub } });
        if (status || payload.assignedTechnicianId || payload.resolution) {
          await tx.workshopWarrantyTicket.update({ where: { id: ticketId }, data: { status: status as never, assignedTechnicianId: payload.assignedTechnicianId ? String(payload.assignedTechnicianId) : undefined, resolution: payload.resolution === undefined ? undefined : String(payload.resolution), resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : undefined, closedAt: status === 'CLOSED' ? new Date() : undefined } });
        }
        if (status === 'CLOSED') await tx.workshopTelemetryEvent.create({ data: { organizationId, actorId: user.sub, eventType: 'WARRANTY_CLOSED', entityType: 'WARRANTY_TICKET', entityId: ticketId } });
        result = { entityId: event.id, ticketId, status: status ?? ticket.status };
      } else {
        throw new BadRequestException('Loại mutation offline chưa được hỗ trợ.');
      }
      return tx.workshopOfflineMutation.create({
        data: { organizationId, clientMutationId, deviceId, entityType, entityId: body.entityId ? String(body.entityId) : undefined, operation, baseRevision: body.baseRevision === undefined ? undefined : Number(body.baseRevision), payload: payload as JsonInput, status: 'APPLIED', result, actorId: user.sub, appliedAt: new Date() },
      });
    });
  }

  async dispatchPendingEvents(user: JwtUser, requestedOrganizationId?: string) {
    if (user.role !== 'ADMIN' && user.role !== 'STAFF') throw new ForbiddenException('Chỉ quản trị viên được phát sự kiện hệ thống.');
    const organizationId = this.org(user, requestedOrganizationId);
    const events = await this.prisma.workshopDomainEventOutbox.findMany({ where: { organizationId, status: 'PENDING', availableAt: { lte: new Date() } }, orderBy: { createdAt: 'asc' }, take: 50 });
    const users = await this.prisma.user.findMany({ where: { organizationId }, select: { id: true } });
    for (const event of events) {
      await this.prisma.$transaction(async (tx) => {
        if (['WORK_ORDER_READY', 'INSTALLATION_SCHEDULED', 'WARRANTY_REQUESTED'].includes(event.eventType)) {
          await tx.notification.createMany({ data: users.map((recipient) => ({ userId: recipient.id, title: event.eventType.replaceAll('_', ' '), body: `Cập nhật ${event.aggregateType}`, type: event.eventType, refId: event.aggregateId })) });
        }
        await tx.workshopDomainEventOutbox.update({ where: { id: event.id }, data: { status: 'PUBLISHED', attempts: { increment: 1 }, publishedAt: new Date() } });
      });
    }
    return { dispatched: events.length };
  }
}
