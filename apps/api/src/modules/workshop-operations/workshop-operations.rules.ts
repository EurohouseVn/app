import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';

export type WorkOrderStatus = 'DRAFT' | 'READY' | 'IN_PROGRESS' | 'PAUSED' | 'DONE' | 'CANCELLED';
export type QcInspectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
export type InstallationStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'EN_ROUTE'
  | 'ON_SITE'
  | 'IN_PROGRESS'
  | 'QC_PENDING'
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'CANCELLED';
export type RemnantStatus = 'AVAILABLE' | 'RESERVED' | 'CONSUMED' | 'SCRAPPED';
export type WorkshopWorkspaceRoleName = 'OWNER' | 'WORKSHOP_MANAGER' | 'SUPERVISOR' | 'WORKER' | 'INSTALLER' | 'ADMIN';
export type WorkshopCapability =
  | 'dashboard.view'
  | 'master.manage'
  | 'inventory.manage'
  | 'work.assign'
  | 'work.execute'
  | 'qc.execute'
  | 'installation.manage'
  | 'installation.execute'
  | 'warranty.manage'
  | 'warranty.execute';

const WORKSPACE_CAPABILITIES: Record<WorkshopWorkspaceRoleName, WorkshopCapability[]> = {
  ADMIN: ['dashboard.view', 'master.manage', 'inventory.manage', 'work.assign', 'work.execute', 'qc.execute', 'installation.manage', 'installation.execute', 'warranty.manage', 'warranty.execute'],
  OWNER: ['dashboard.view', 'master.manage', 'inventory.manage', 'work.assign', 'work.execute', 'qc.execute', 'installation.manage', 'installation.execute', 'warranty.manage', 'warranty.execute'],
  WORKSHOP_MANAGER: ['dashboard.view', 'master.manage', 'inventory.manage', 'work.assign', 'work.execute', 'qc.execute', 'installation.manage', 'installation.execute', 'warranty.manage', 'warranty.execute'],
  SUPERVISOR: ['dashboard.view', 'inventory.manage', 'work.assign', 'work.execute', 'qc.execute', 'installation.execute', 'warranty.execute'],
  WORKER: ['work.execute', 'qc.execute'],
  INSTALLER: ['installation.execute', 'warranty.execute', 'qc.execute'],
};

const WORK_ORDER_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  DRAFT: ['READY', 'CANCELLED'],
  READY: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PAUSED', 'DONE', 'CANCELLED'],
  PAUSED: ['IN_PROGRESS', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

const INSTALLATION_TRANSITIONS: Record<InstallationStatus, InstallationStatus[]> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['ON_SITE', 'CANCELLED'],
  ON_SITE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['QC_PENDING', 'CANCELLED'],
  QC_PENDING: ['IN_PROGRESS', 'ACCEPTED'],
  ACCEPTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

const REMNANT_TRANSITIONS: Record<RemnantStatus, RemnantStatus[]> = {
  AVAILABLE: ['RESERVED', 'SCRAPPED'],
  RESERVED: ['AVAILABLE', 'CONSUMED', 'SCRAPPED'],
  CONSUMED: [],
  SCRAPPED: [],
};

export function organizationScope(user: JwtUser, requestedOrganizationId?: string): string {
  if ((user.isCeo || user.role === 'ADMIN') && requestedOrganizationId) {
    return requestedOrganizationId;
  }
  if (user.organizationId) {
    if (requestedOrganizationId && requestedOrganizationId !== user.organizationId) {
      throw new ForbiddenException('Không được truy cập dữ liệu của tổ chức khác.');
    }
    return user.organizationId;
  }
  if ((user.role === 'ADMIN' || user.role === 'STAFF') && requestedOrganizationId) {
    return requestedOrganizationId;
  }
  throw new ForbiddenException('Tài khoản chưa được gắn tổ chức vận hành.');
}

export function assertOrganizationOwnership(actual: string | null | undefined, expected: string) {
  if (!actual || actual !== expected) throw new ForbiddenException('Không được truy cập dữ liệu của tổ chức khác.');
}

export function assertWorkOrderTransition(from: string, to: string) {
  const allowed = WORK_ORDER_TRANSITIONS[from as WorkOrderStatus];
  if (!allowed || !allowed.includes(to as WorkOrderStatus)) {
    throw new ConflictException(`Không thể chuyển lệnh việc từ ${from} sang ${to}.`);
  }
}

export function assertInstallationTransition(from: string, to: string) {
  const allowed = INSTALLATION_TRANSITIONS[from as InstallationStatus];
  if (!allowed || !allowed.includes(to as InstallationStatus)) {
    throw new ConflictException(`Không thể chuyển lịch lắp đặt từ ${from} sang ${to}.`);
  }
}

export function assertRemnantTransition(from: string, to: string) {
  const allowed = REMNANT_TRANSITIONS[from as RemnantStatus];
  if (!allowed || !allowed.includes(to as RemnantStatus)) {
    throw new ConflictException(`Không thể chuyển đầu mẩu từ ${from} sang ${to}.`);
  }
}

export function inventorySignedQuantity(type: string, quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Số lượng phải lớn hơn 0.');
  if (type === 'RECEIVE' || type === 'RETURN') return quantity;
  if (type === 'ISSUE' || type === 'SCRAP') return -quantity;
  if (type === 'TRANSFER' || type === 'RESERVE' || type === 'UNRESERVE') return 0;
  if (type === 'ADJUST') throw new BadRequestException('ADJUST phải khai báo adjustmentDelta khác 0.');
  throw new BadRequestException('Loại giao dịch kho không hợp lệ.');
}

export function inventoryBalance(
  transactions: Array<{
    transactionType: string;
    quantity: number | { toString(): string };
    adjustmentDelta?: number | { toString(): string } | null;
  }>,
): number {
  return transactions.reduce((total, item) => {
    if (item.transactionType === 'ADJUST') return total + Number(item.adjustmentDelta ?? 0);
    return total + inventorySignedQuantity(item.transactionType, Number(item.quantity));
  }, 0);
}

export function calculateQuickQuoteLines(
  lines: Array<{ lineType: string; quantity: number; unitPrice: number; widthMm?: number; heightMm?: number }>,
) {
  return lines.map((line, index) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    if (!(quantity > 0) || unitPrice < 0) throw new BadRequestException(`Dòng ${index + 1} có số lượng hoặc đơn giá không hợp lệ.`);
    const basis = line.lineType === 'AREA'
      ? (Number(line.widthMm) * Number(line.heightMm)) / 1_000_000
      : quantity;
    if (!(basis > 0)) throw new BadRequestException(`Dòng ${index + 1} thiếu kích thước tính diện tích.`);
    return { ...line, calculatedQuantity: basis, total: Math.round(basis * unitPrice) };
  });
}

export function nextPriceBookVersion(existingVersions: number[]): number {
  return (existingVersions.length ? Math.max(...existingVersions) : 0) + 1;
}

export function projectCostsFromPayments(payments: Array<{ category: string; amount: number }>) {
  const totals = {
    costAluminum: 0,
    costAccessory: 0,
    costGlass: 0,
    costLabor: 0,
    costTransport: 0,
    costInstallation: 0,
    costOther: 0,
  };
  for (const payment of payments) {
    const category = (payment.category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const amount = Math.max(0, Number(payment.amount) || 0);
    if (category.includes('nhom')) totals.costAluminum += amount;
    else if (category.includes('phu kien')) totals.costAccessory += amount;
    else if (category.includes('kinh')) totals.costGlass += amount;
    else if (category.includes('nhan cong')) totals.costLabor += amount;
    else if (category.includes('van chuyen')) totals.costTransport += amount;
    else if (category.includes('lap dat')) totals.costInstallation += amount;
    else totals.costOther += amount;
  }
  return totals;
}

export function assertPriceBookVersionCanActivate(input: { validFrom?: Date | null; validTo?: Date | null }, now = new Date()) {
  if (input.validFrom && input.validTo && input.validFrom >= input.validTo) {
    throw new BadRequestException('Khoảng hiệu lực bảng giá không hợp lệ.');
  }
  if (input.validTo && input.validTo <= now) throw new ConflictException('Không thể kích hoạt phiên bản đã hết hiệu lực.');
}

export function assertQcCompletion(results: Array<{ result: string }>) {
  if (!results.length) throw new BadRequestException('Phiếu QC phải có ít nhất một kết quả kiểm tra.');
  if (results.some((item) => !['PASS', 'FAIL', 'REWORK'].includes(item.result))) {
    throw new BadRequestException('Kết quả QC không hợp lệ.');
  }
}

export function assertQcRequiredChecks(
  requiredCheckKeys: string[],
  results: Array<{ checkKey: string; result: string }>,
) {
  const resultByKey = new Map(results.map((item) => [item.checkKey, item.result]));
  const missing = requiredCheckKeys.filter((checkKey) => !resultByKey.has(checkKey));
  if (missing.length) {
    throw new BadRequestException(`Thiếu kết quả cho tiêu chí QC bắt buộc: ${missing.join(', ')}.`);
  }
}

export function assertQcFailureEvidence(
  results: Array<{ result: string; photoObjectIds?: string[] }>,
  inspectionPhotoObjectIds: string[] = [],
) {
  if (!results.some((item) => item.result === 'FAIL' || item.result === 'REWORK')) return;
  const hasEvidence = inspectionPhotoObjectIds.length > 0 || results.some((item) => (item.photoObjectIds?.length ?? 0) > 0);
  if (!hasEvidence) throw new BadRequestException('Hạng mục không đạt hoặc làm lại phải có ít nhất một ảnh hiện trường.');
}

export function assertInstallationCanComplete(input: {
  status: string;
  acceptedAt?: Date | null;
  customerSignatureObjectId?: string | null;
  requiresCustomerSignature?: boolean;
  requiredPhotoCount?: number;
  photoObjectIds?: string[];
  qcPassed?: boolean;
  materialsChecklistComplete?: boolean;
  toolsChecklistComplete?: boolean;
}) {
  if (input.status !== 'ACCEPTED') throw new ConflictException('Công việc phải được khách hàng nghiệm thu trước khi hoàn tất.');
  if (!input.acceptedAt) throw new BadRequestException('Thiếu thời điểm nghiệm thu của khách hàng.');
  if (input.requiresCustomerSignature !== false && !input.customerSignatureObjectId) throw new BadRequestException('Thiếu chữ ký khách hàng.');
  if ((input.photoObjectIds?.length ?? 0) < (input.requiredPhotoCount ?? 0)) throw new BadRequestException('Chưa đủ ảnh lắp đặt bắt buộc.');
  if (input.qcPassed === false) throw new BadRequestException('Chưa có kết quả QC đạt yêu cầu cho công việc lắp đặt.');
  if (input.materialsChecklistComplete === false) throw new BadRequestException('Chưa xác nhận đủ vật tư lắp đặt bắt buộc.');
  if (input.toolsChecklistComplete === false) throw new BadRequestException('Chưa xác nhận đủ dụng cụ lắp đặt bắt buộc.');
}

const WARRANTY_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['SCHEDULED', 'IN_PROGRESS', 'REJECTED'],
  SCHEDULED: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
  REJECTED: [],
};

export function assertWarrantyTransition(from: string, to: string, resolution = '') {
  if (from === to) return;
  if (!WARRANTY_TRANSITIONS[from]?.includes(to)) throw new ConflictException(`Không thể chuyển phiếu bảo hành từ ${from} sang ${to}.`);
  if ((to === 'RESOLVED' || to === 'CLOSED') && !resolution.trim()) throw new BadRequestException('Cần ghi rõ kết quả xử lý trước khi hoàn tất phiếu bảo hành.');
}

export function installationChecklistComplete(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (typeof item === 'string') return false;
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return record.required === false || record.checked === true;
  });
}

export function assertQrEntityAuthorized(entityOrganizationId: string, requesterOrganizationId: string) {
  assertOrganizationOwnership(entityOrganizationId, requesterOrganizationId);
}

export function assertWarrantyAssetAccess(entityOrganizationId: string, requesterOrganizationId: string) {
  assertOrganizationOwnership(entityOrganizationId, requesterOrganizationId);
}

export function resolveOfflineMutation(
  serverRevision: number,
  baseRevision: number | undefined,
): 'APPLY' | 'CONFLICT' {
  return baseRevision === undefined || baseRevision === serverRevision ? 'APPLY' : 'CONFLICT';
}

export function workspaceCapabilities(role: WorkshopWorkspaceRoleName): WorkshopCapability[] {
  return [...WORKSPACE_CAPABILITIES[role]];
}

export function assertWorkspaceCapability(role: WorkshopWorkspaceRoleName, capability: WorkshopCapability) {
  if (!WORKSPACE_CAPABILITIES[role].includes(capability)) {
    throw new ForbiddenException('Vai trò vận hành không được thực hiện thao tác này.');
  }
}

export function eventRetryDelayMs(attempt: number): number {
  return Math.min(60 * 60 * 1000, 5_000 * (2 ** Math.max(0, attempt - 1)));
}

export function eventShouldDeadLetter(attempt: number, maxAttempts = 5): boolean {
  return attempt >= maxAttempts;
}

export function mediaDeduplicationKey(input: { organizationId: string; checksum: string; entityType: string; entityId: string }) {
  return `${input.organizationId}:${input.entityType}:${input.entityId}:${input.checksum}`;
}
