import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, WorkshopWorkspaceRole } from '@prisma/client';
import { createHash } from 'crypto';
import * as path from 'path';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { uploadedFileBuffer } from '../../common/upload';
import { WorkshopAccessService } from './workshop-access.service';
import type { WorkshopOperationsFeature } from './workshop-operations.feature-flags';

type UploadedFileLike = { buffer?: Buffer; path?: string; originalname?: string; mimetype?: string; size?: number };
type PilotFlags = Record<WorkshopOperationsFeature, boolean>;

const PILOT_KEYS: WorkshopOperationsFeature[] = ['survey', 'inventory', 'shopFloor', 'quality', 'installation', 'warranty'];
const DISABLED_PILOT_FLAGS: PilotFlags = {
  survey: false,
  inventory: false,
  shopFloor: false,
  quality: false,
  installation: false,
  warranty: false,
};

@Injectable()
export class WorkshopPilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: WorkshopAccessService,
  ) {}

  async flags(user: JwtUser, requestedOrganizationId?: string): Promise<PilotFlags & { source: string; version: number }> {
    const organizationId = this.access.organization(user, requestedOrganizationId);
    const config = await this.prisma.workshopPilotConfig.findUnique({ where: { organizationId } });
    if (!config) return { ...DISABLED_PILOT_FLAGS, source: 'NO_TENANT_CONFIG', version: 0 };
    return {
      survey: config.active && config.survey,
      inventory: config.active && config.inventory,
      shopFloor: config.active && config.shopFloor,
      quality: config.active && config.quality,
      installation: config.active && config.installation,
      warranty: config.active && config.warranty,
      source: config.active ? 'TENANT_PILOT' : 'TENANT_ROLLBACK',
      version: config.version,
    };
  }

  async featureEnabled(user: JwtUser, feature: WorkshopOperationsFeature, requestedOrganizationId?: string) {
    if (user.isCeo || user.role === 'ADMIN') return true;
    return (await this.flags(user, requestedOrganizationId))[feature];
  }

  async getPilotConfig(user: JwtUser, requestedOrganizationId?: string) {
    const organizationId = this.access.organization(user, requestedOrganizationId);
    await this.access.assert(user, organizationId, 'dashboard.view');
    const config = await this.prisma.workshopPilotConfig.findUnique({ where: { organizationId } });
    return { organizationId, config, effectiveFlags: await this.flags(user, organizationId) };
  }

  async updatePilotConfig(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.access.organization(user, body.organizationId ? String(body.organizationId) : undefined);
    await this.access.assert(user, organizationId, 'master.manage');
    const current = await this.prisma.workshopPilotConfig.findUnique({ where: { organizationId } });
    const active = body.active === true;
    const next = Object.fromEntries(PILOT_KEYS.map((key) => [key, body[key] === true])) as PilotFlags;
    const previousConfig = current
      ? { active: current.active, ...Object.fromEntries(PILOT_KEYS.map((key) => [key, current[key]])), version: current.version }
      : null;
    return this.prisma.$transaction(async (tx) => {
      const config = await tx.workshopPilotConfig.upsert({
        where: { organizationId },
        create: { organizationId, active, ...next, version: 1, previousConfig: previousConfig ?? undefined, enabledAt: active ? new Date() : undefined, disabledAt: active ? undefined : new Date(), updatedById: user.sub },
        update: { active, ...next, version: { increment: 1 }, previousConfig: previousConfig ?? undefined, enabledAt: active ? new Date() : current?.enabledAt, disabledAt: active ? null : new Date(), updatedById: user.sub },
      });
      await tx.workshopAuditEvent.create({ data: { organizationId, entityType: 'PilotConfig', entityId: config.id, action: active ? 'ENABLE_OR_UPDATE' : 'ROLLBACK', actorId: user.sub, fromStatus: current?.active ? 'ACTIVE' : 'INACTIVE', toStatus: active ? 'ACTIVE' : 'INACTIVE', metadata: next } });
      return config;
    });
  }

  async rollbackPilot(user: JwtUser, requestedOrganizationId?: string) {
    const organizationId = this.access.organization(user, requestedOrganizationId);
    await this.access.assert(user, organizationId, 'master.manage');
    const current = await this.prisma.workshopPilotConfig.findUnique({ where: { organizationId } });
    if (!current) throw new NotFoundException('Tổ chức chưa có cấu hình pilot.');
    return this.updatePilotConfig(user, { organizationId, active: false });
  }

  async workspace(user: JwtUser, requestedOrganizationId?: string) {
    return this.access.workspace(user, requestedOrganizationId);
  }

  async assignRole(user: JwtUser, body: Record<string, unknown>) {
    return this.access.assign(user, {
      organizationId: body.organizationId ? String(body.organizationId) : undefined,
      userId: String(body.userId ?? ''),
      role: String(body.role ?? 'WORKER') as WorkshopWorkspaceRole,
      active: body.active !== false,
    });
  }

  async organizationPeople(user: JwtUser, requestedOrganizationId?: string) {
    const organizationId = this.access.organization(user, requestedOrganizationId);
    await this.access.assert(user, organizationId, 'master.manage');
    const [users, assignments, workers] = await Promise.all([
      this.prisma.user.findMany({ where: { organizationId }, select: { id: true, displayName: true, email: true, role: true }, orderBy: { displayName: 'asc' } }),
      this.prisma.workshopRoleAssignment.findMany({ where: { organizationId, active: true } }),
      this.prisma.workshopWorker.findMany({ where: { organizationId }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    ]);
    return { users, assignments, workers };
  }

  async adminContext(user: JwtUser, requestedOrganizationId?: string) {
    const organizationId = this.access.organization(user, requestedOrganizationId);
    await this.access.assert(user, organizationId, 'dashboard.view');
    const [warehouses, machines, suppliers, teams, workers, priceBooks, qcTemplates, installations, warrantyAssets, remnants, transactions] = await Promise.all([
      this.prisma.workshopWarehouse.findMany({ where: { organizationId }, include: { locations: true }, orderBy: { name: 'asc' } }),
      this.prisma.workshopMachine.findMany({ where: { organizationId }, orderBy: { name: 'asc' } }),
      this.prisma.workshopSupplier.findMany({ where: { organizationId }, include: { materials: true }, orderBy: { name: 'asc' } }),
      this.prisma.workshopTeam.findMany({ where: { organizationId }, include: { members: true }, orderBy: { name: 'asc' } }),
      this.prisma.workshopWorker.findMany({ where: { organizationId }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
      this.prisma.priceBook.findMany({ where: { ownerOrganizationId: organizationId }, include: { versions: { include: { items: true }, orderBy: { versionNumber: 'desc' }, take: 3 } }, orderBy: { name: 'asc' } }),
      this.prisma.workshopQcTemplate.findMany({ where: { organizationId }, include: { items: { orderBy: { sortOrder: 'asc' } } }, orderBy: { name: 'asc' } }),
      this.prisma.workshopInstallationJob.findMany({ where: { organizationId }, include: { project: { select: { code: true, name: true, address: true } } }, orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'desc' }], take: 50 }),
      this.prisma.workshopWarrantyAsset.findMany({ where: { organizationId }, include: { project: { select: { code: true, name: true } }, tickets: { orderBy: { createdAt: 'desc' } } }, orderBy: { installedAt: 'desc' }, take: 50 }),
      this.prisma.workshopStockRemnant.findMany({ where: { organizationId, status: { in: ['AVAILABLE', 'RESERVED'] } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.workshopInventoryTransaction.findMany({ where: { organizationId }, orderBy: { occurredAt: 'desc' }, take: 100 }),
    ]);
    const warehouseContext = warehouses.map((warehouse) => {
      const recent = transactions.filter((item) => item.fromWarehouseId === warehouse.id || item.toWarehouseId === warehouse.id);
      return {
        ...warehouse,
        activeRemnants: remnants.filter((item) => item.warehouseId === warehouse.id).length,
        recentTransactions: recent.slice(0, 10),
        receivedQuantity: recent.filter((item) => item.toWarehouseId === warehouse.id && ['RECEIVE', 'RETURN', 'TRANSFER'].includes(item.transactionType)).reduce((sum, item) => sum + Number(item.quantity), 0),
        issuedQuantity: recent.filter((item) => item.fromWarehouseId === warehouse.id && ['ISSUE', 'SCRAP', 'TRANSFER'].includes(item.transactionType)).reduce((sum, item) => sum + Number(item.quantity), 0),
      };
    });
    return { warehouses: warehouseContext, machines, suppliers, teams, workers, priceBooks, qcTemplates, installations, warrantyAssets };
  }

  async updateMasterEntity(user: JwtUser, entity: string, id: string, body: Record<string, unknown>) {
    const organizationId = this.access.organization(user, body.organizationId ? String(body.organizationId) : undefined);
    await this.access.assert(user, organizationId, 'master.manage');
    const cleanText = (value: unknown) => String(value ?? '').trim();
    if (entity === 'warehouse') {
      await this.exists('workshopWarehouse', id, organizationId);
      return this.prisma.workshopWarehouse.update({ where: { id }, data: { ...(body.name !== undefined ? { name: cleanText(body.name) } : {}), ...(body.address !== undefined ? { address: cleanText(body.address) } : {}), ...(body.active !== undefined ? { active: body.active === true } : {}) } });
    }
    if (entity === 'location') {
      await this.exists('workshopWarehouseLocation', id, organizationId);
      return this.prisma.workshopWarehouseLocation.update({ where: { id }, data: { ...(body.name !== undefined ? { name: cleanText(body.name) } : {}), ...(body.locationType !== undefined ? { locationType: cleanText(body.locationType) } : {}), ...(body.active !== undefined ? { active: body.active === true } : {}) } });
    }
    if (entity === 'supplier') {
      await this.exists('workshopSupplier', id, organizationId);
      return this.prisma.workshopSupplier.update({ where: { id }, data: { ...(body.name !== undefined ? { name: cleanText(body.name) } : {}), ...(body.phone !== undefined ? { phone: cleanText(body.phone) } : {}), ...(body.leadTimeDays !== undefined ? { leadTimeDays: Number(body.leadTimeDays) } : {}), ...(body.paymentTerms !== undefined ? { paymentTerms: cleanText(body.paymentTerms) } : {}), ...(body.deliveryNotes !== undefined ? { deliveryNotes: cleanText(body.deliveryNotes) } : {}), ...(body.status !== undefined ? { status: cleanText(body.status) } : {}) } });
    }
    if (entity === 'machine') {
      await this.exists('workshopMachine', id, organizationId);
      return this.prisma.workshopMachine.update({ where: { id }, data: { ...(body.name !== undefined ? { name: cleanText(body.name) } : {}), ...(body.machineType !== undefined ? { machineType: cleanText(body.machineType) } : {}), ...(body.kerfMm !== undefined ? { kerfMm: Number(body.kerfMm) } : {}), ...(body.minimumCutMm !== undefined ? { minimumCutMm: Number(body.minimumCutMm) } : {}), ...(body.maximumStockMm !== undefined ? { maximumStockMm: Number(body.maximumStockMm) } : {}), ...(body.angleCapabilities !== undefined ? { angleCapabilities: body.angleCapabilities as Prisma.InputJsonValue } : {}), ...(body.note !== undefined ? { note: cleanText(body.note) } : {}), ...(body.active !== undefined ? { active: body.active === true } : {}) } });
    }
    if (entity === 'team') {
      await this.exists('workshopTeam', id, organizationId);
      return this.prisma.workshopTeam.update({ where: { id }, data: { ...(body.name !== undefined ? { name: cleanText(body.name) } : {}), ...(body.teamType !== undefined ? { teamType: cleanText(body.teamType) } : {}), ...(body.active !== undefined ? { active: body.active === true } : {}) } });
    }
    if (entity === 'qc-template') {
      await this.exists('workshopQcTemplate', id, organizationId);
      return this.prisma.workshopQcTemplate.update({ where: { id }, data: { ...(body.name !== undefined ? { name: cleanText(body.name) } : {}), ...(body.active !== undefined ? { active: body.active === true } : {}) }, include: { items: true } });
    }
    throw new BadRequestException('Loại dữ liệu quản trị không hợp lệ.');
  }

  async addTeamMember(user: JwtUser, teamId: string, body: Record<string, unknown>) {
    const organizationId = this.access.organization(user, body.organizationId ? String(body.organizationId) : undefined);
    await this.access.assert(user, organizationId, 'master.manage');
    await this.exists('workshopTeam', teamId, organizationId);
    const workerId = String(body.workerId ?? '');
    const worker = await this.prisma.workshopWorker.findFirst({ where: { id: workerId, organizationId } });
    if (!worker) throw new NotFoundException('Không tìm thấy nhân sự trong xưởng này.');
    return this.prisma.workshopTeamMember.upsert({
      where: { teamId_workerId: { teamId, workerId } },
      create: { teamId, workerId, roleName: String(body.roleName ?? worker.roleName) },
      update: { roleName: String(body.roleName ?? worker.roleName), leftAt: null },
    });
  }

  async uploadMedia(user: JwtUser, body: Record<string, unknown>, file: UploadedFileLike) {
    if (!file) throw new BadRequestException('Chưa chọn ảnh hoặc video.');
    const mime = String(file.mimetype ?? '').toLowerCase();
    if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
      throw new BadRequestException('Chỉ chấp nhận ảnh hoặc video phục vụ vận hành.');
    }
    const organizationId = this.access.organization(user, body.organizationId ? String(body.organizationId) : undefined);
    const localId = String(body.localId ?? '').trim();
    const deviceId = String(body.deviceId ?? '').trim();
    const entityType = String(body.entityType ?? '').trim().toUpperCase();
    const entityId = String(body.entityId ?? '').trim();
    if (!localId || !deviceId || !entityType || !entityId) throw new BadRequestException('Thiếu định danh media đồng bộ.');
    await this.assertEntityOrganization(entityType, entityId, organizationId);
    const buffer = await uploadedFileBuffer(file);
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const duplicate = await this.prisma.workshopMediaUpload.findFirst({ where: { organizationId, entityType, entityId, checksum, uploadState: 'UPLOADED' } });
    if (duplicate) {
      return this.prisma.workshopMediaUpload.upsert({
        where: { organizationId_deviceId_localId: { organizationId, deviceId, localId } },
        create: { organizationId, localId, deviceId, entityType, entityId, mime, sizeBytes: buffer.length, checksum, required: String(body.required) === 'true', uploadState: 'UPLOADED', storageObjectId: duplicate.storageObjectId, uploadedAt: duplicate.uploadedAt ?? new Date(), createdById: user.sub, metadata: { deduplicatedFrom: duplicate.id } },
        update: { uploadState: 'UPLOADED', storageObjectId: duplicate.storageObjectId, uploadedAt: duplicate.uploadedAt ?? new Date(), lastError: '' },
      });
    }
    const record = await this.prisma.workshopMediaUpload.upsert({
      where: { organizationId_deviceId_localId: { organizationId, deviceId, localId } },
      create: { organizationId, localId, deviceId, entityType, entityId, mime, sizeBytes: buffer.length, checksum, required: String(body.required) === 'true', uploadState: 'UPLOADING', createdById: user.sub },
      update: { uploadState: 'UPLOADING', retryCount: { increment: 1 }, lastError: '' },
    });
    try {
      const stored = await this.storage.putUpload({ buffer, originalName: file.originalname, mime, purpose: 'workshop-pilot-media', ownerOrganizationId: organizationId, ownerUserId: user.sub, extension: path.extname(file.originalname || ''), metadata: { entityType, entityId, mediaUploadId: record.id } });
      return await this.prisma.workshopMediaUpload.update({ where: { id: record.id }, data: { uploadState: 'UPLOADED', storageObjectId: stored.id, checksum: stored.sha256, sizeBytes: stored.sizeBytes, uploadedAt: new Date(), lastError: '' } });
    } catch (error) {
      await this.prisma.workshopMediaUpload.update({ where: { id: record.id }, data: { uploadState: 'FAILED', lastError: error instanceof Error ? error.message.slice(0, 500) : 'Không tải được media.' } });
      throw error;
    }
  }

  async media(user: JwtUser, query: { organizationId?: string; deviceId?: string; state?: string }) {
    const organizationId = this.access.organization(user, query.organizationId);
    return this.prisma.workshopMediaUpload.findMany({ where: { organizationId, ...(query.deviceId ? { deviceId: query.deviceId } : {}), ...(query.state ? { uploadState: query.state as never } : {}) }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async cancelMedia(user: JwtUser, id: string, requestedOrganizationId?: string) {
    const organizationId = this.access.organization(user, requestedOrganizationId);
    const record = await this.prisma.workshopMediaUpload.findFirst({ where: { id, organizationId } });
    if (!record) throw new NotFoundException('Không tìm thấy media đồng bộ.');
    if (record.uploadState === 'UPLOADED') throw new ConflictException('Media đã tải lên, không thể hủy từ hàng đợi.');
    return this.prisma.workshopMediaUpload.update({ where: { id }, data: { uploadState: 'CANCELLED', cancelledAt: new Date(), lastError: '' } });
  }

  async recordTelemetry(user: JwtUser, body: Record<string, unknown>) {
    const organizationId = this.access.organization(user, body.organizationId ? String(body.organizationId) : undefined);
    const eventType = String(body.eventType ?? '').trim().toUpperCase();
    if (!eventType || eventType.length > 80) throw new BadRequestException('Loại telemetry không hợp lệ.');
    const raw = body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : {};
    const metadata = Object.fromEntries(['screen', 'action', 'reasonCode', 'queueType', 'network', 'operation'].filter((key) => raw[key] !== undefined).map((key) => [key, raw[key]]));
    return this.prisma.workshopTelemetryEvent.create({ data: { organizationId, actorId: user.sub, deviceId: body.deviceId ? String(body.deviceId) : undefined, sessionId: body.sessionId ? String(body.sessionId) : undefined, eventType, entityType: body.entityType ? String(body.entityType) : undefined, entityId: body.entityId ? String(body.entityId) : undefined, durationMs: body.durationMs === undefined ? undefined : Math.max(0, Math.round(Number(body.durationMs))), success: body.success !== false, metadata: metadata as Prisma.InputJsonValue } });
  }

  async telemetrySummary(user: JwtUser, requestedOrganizationId?: string, days = 7) {
    const organizationId = this.access.organization(user, requestedOrganizationId);
    await this.access.assert(user, organizationId, 'dashboard.view');
    const since = new Date(Date.now() - Math.min(90, Math.max(1, days)) * 86_400_000);
    const events = await this.prisma.workshopTelemetryEvent.findMany({ where: { organizationId, occurredAt: { gte: since } }, select: { actorId: true, eventType: true, durationMs: true, success: true, occurredAt: true } });
    const count = (type: string) => events.filter((item) => item.eventType === type).length;
    const surveyDurations = events.filter((item) => item.eventType === 'SURVEY_COMPLETED' && item.durationMs !== null).map((item) => item.durationMs as number);
    const workOrders = await this.prisma.workshopWorkOrder.findMany({ where: { organizationId, createdAt: { gte: since } }, include: { histories: true } });
    return {
      periodDays: days,
      dailyActiveUsers: new Set(events.filter((item) => item.actorId).map((item) => `${item.actorId}:${item.occurredAt.toISOString().slice(0, 10)}`)).size,
      surveyCompletionCount: count('SURVEY_COMPLETED'),
      averageSurveyDurationMs: surveyDurations.length ? Math.round(surveyDurations.reduce((sum, value) => sum + value, 0) / surveyDurations.length) : 0,
      qcInspections: count('QC_COMPLETED'), reworkCount: count('QC_REWORK'), installationCompletion: count('INSTALLATION_COMPLETED'),
      offlineQueueFailures: count('OFFLINE_QUEUE_FAILED'), syncConflicts: count('SYNC_CONFLICT'), mediaUploadFailures: count('MEDIA_UPLOAD_FAILED'), applicationErrors: count('APPLICATION_ERROR'),
      funnel: {
        assigned: workOrders.length,
        opened: workOrders.filter((item) => item.histories.some((history) => history.action === 'OPEN')).length,
        started: workOrders.filter((item) => item.startedAt).length,
        completed: workOrders.filter((item) => item.completedAt).length,
        closedSuccessfully: workOrders.filter((item) => item.status === 'DONE').length,
      },
    };
  }

  async conflicts(user: JwtUser, requestedOrganizationId?: string) {
    const organizationId = this.access.organization(user, requestedOrganizationId);
    return this.prisma.workshopOfflineMutation.findMany({ where: { organizationId, status: 'CONFLICT' }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async resolveConflict(user: JwtUser, id: string, body: Record<string, unknown>) {
    const organizationId = this.access.organization(user, body.organizationId ? String(body.organizationId) : undefined);
    const mutation = await this.prisma.workshopOfflineMutation.findFirst({ where: { id, organizationId, status: 'CONFLICT' } });
    if (!mutation) throw new NotFoundException('Không tìm thấy xung đột đang chờ xử lý.');
    const resolution = String(body.resolution ?? 'KEEP_SERVER');
    if (resolution === 'KEEP_SERVER') return this.prisma.workshopOfflineMutation.update({ where: { id }, data: { status: 'APPLIED', result: { resolution: 'KEEP_SERVER' }, appliedAt: new Date() } });
    if (resolution !== 'APPLY_CLIENT' || mutation.entityType !== 'OPENING' || mutation.operation !== 'MEASURE' || !mutation.entityId) {
      throw new BadRequestException('Xung đột này chỉ hỗ trợ giữ bản máy chủ.');
    }
    const payload = mutation.payload as Record<string, unknown>;
    return this.prisma.$transaction(async (tx) => {
      const opening = await tx.workshopOpening.findFirst({ where: { id: mutation.entityId as string, organizationId } });
      if (!opening) throw new NotFoundException('Ô chờ không còn tồn tại.');
      const revision = opening.revision + 1;
      const widthMm = Math.round(Number(payload.widthMm));
      const heightMm = Math.round(Number(payload.heightMm));
      if (!(widthMm > 0) || !(heightMm > 0)) throw new BadRequestException('Kích thước xung đột không hợp lệ.');
      const measurement = await tx.openingMeasurement.create({ data: { organizationId, openingId: opening.id, revision, widthMm, heightMm, note: String(payload.note ?? ''), status: 'MEASURED', measuredById: user.sub } });
      await tx.workshopOpening.update({ where: { id: opening.id }, data: { revision, widthMm, heightMm, measurementStatus: 'MEASURED' } });
      return tx.workshopOfflineMutation.update({ where: { id }, data: { status: 'APPLIED', result: { resolution: 'APPLY_CLIENT', measurementId: measurement.id, revision }, appliedAt: new Date() } });
    });
  }

  private async exists(model: 'workshopWarehouse' | 'workshopWarehouseLocation' | 'workshopSupplier' | 'workshopMachine' | 'workshopTeam' | 'workshopQcTemplate', id: string, organizationId: string) {
    const record = await (this.prisma[model] as unknown as { findFirst(input: unknown): Promise<unknown> }).findFirst({ where: { id, organizationId } });
    if (!record) throw new NotFoundException('Không tìm thấy dữ liệu trong tổ chức này.');
  }

  private async assertEntityOrganization(entityType: string, entityId: string, organizationId: string) {
    let actual = '';
    if (entityType === 'PROJECT') actual = (await this.prisma.project.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    else if (entityType === 'OPENING') actual = (await this.prisma.workshopOpening.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    else if (entityType === 'WORK_ORDER') actual = (await this.prisma.workshopWorkOrder.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    else if (entityType === 'QC_INSPECTION') actual = (await this.prisma.workshopQcInspection.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    else if (entityType === 'INSTALLATION') actual = (await this.prisma.workshopInstallationJob.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    else if (entityType === 'WARRANTY_TICKET') actual = (await this.prisma.workshopWarrantyTicket.findUnique({ where: { id: entityId }, select: { organizationId: true } }))?.organizationId ?? '';
    if (!actual || actual !== organizationId) throw new NotFoundException('Không tìm thấy đối tượng media trong tổ chức này.');
  }
}
