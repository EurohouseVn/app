import type { EurohouseAccessStatus, EurohouseFeatureCapability, EurohouseFeatureKey } from '@eurohouse/types';

export type WorkshopRelationship = 'UNASSIGNED' | 'MANAGED' | 'OTHER_NPP';

export type WorkshopSearchResult = {
  organizationId: string;
  organizationName: string;
  province?: string;
  maskedEmail?: string;
  maskedPhone?: string;
  relationship: WorkshopRelationship;
  features: Record<EurohouseFeatureKey, EurohouseFeatureCapability>;
};

export type EurohouseAccessState = {
  results: WorkshopSearchResult[];
  selected?: WorkshopSearchResult;
  inviteSelection: Record<EurohouseFeatureKey, boolean>;
  oneTimeCode?: string;
  oneTimeCodeExpiresAt?: string;
};

export function createEurohouseAccessState(): EurohouseAccessState {
  return { results: [], inviteSelection: { FORMULA_CUTTING: true, EUROHOUSE_ORDERING: false } };
}

export function selectedFeatureKeys(state: EurohouseAccessState): EurohouseFeatureKey[] {
  return (['FORMULA_CUTTING', 'EUROHOUSE_ORDERING'] as const).filter((key) => state.inviteSelection[key]);
}

export function toggleInviteFeature(state: EurohouseAccessState, key: EurohouseFeatureKey, selected: boolean): EurohouseAccessState {
  const next = { ...state.inviteSelection, [key]: selected };
  if (!Object.values(next).some(Boolean)) return state;
  return { ...state, inviteSelection: next };
}

export function setSearchResults(state: EurohouseAccessState, results: Array<WorkshopSearchResult & { email?: string; phone?: string }>): EurohouseAccessState {
  const safeResults = results.map(({ organizationId, organizationName, province, maskedEmail, maskedPhone, relationship, features }) => ({
    organizationId, organizationName, province, maskedEmail, maskedPhone, relationship, features,
  }));
  const selected = state.selected ? safeResults.find((row) => row.organizationId === state.selected?.organizationId) : undefined;
  return { ...state, results: safeResults, selected };
}

export function selectWorkshop(state: EurohouseAccessState, organizationId: string): EurohouseAccessState {
  return clearOneTimeCode({ ...state, selected: state.results.find((row) => row.organizationId === organizationId) });
}

export function patchFeatureStatus(
  state: EurohouseAccessState,
  organizationId: string,
  featureKey: EurohouseFeatureKey,
  status: EurohouseAccessStatus,
  relationship?: WorkshopRelationship,
): EurohouseAccessState {
  const results = state.results.map((row) => row.organizationId === organizationId ? {
    ...row,
    relationship: relationship ?? row.relationship,
    features: {
      ...row.features,
      [featureKey]: { ...row.features[featureKey], status, enabled: status === 'ACTIVE' },
    },
  } : row);
  return setSearchResults({ ...state, results }, results);
}

export function setCreatedInvite(state: EurohouseAccessState, invite: { plainCode: string; expiresAt: string }): EurohouseAccessState {
  return { ...state, oneTimeCode: invite.plainCode, oneTimeCodeExpiresAt: invite.expiresAt };
}

export function clearOneTimeCode(state: EurohouseAccessState): EurohouseAccessState {
  return { ...state, oneTimeCode: undefined, oneTimeCodeExpiresAt: undefined };
}

export function statusLabel(status: EurohouseAccessStatus) {
  return status === 'ACTIVE' ? 'Đã kích hoạt' : status === 'REVOKED' ? 'Đã thu hồi' : 'Chưa kích hoạt';
}

export function inviteStatusLabel(status: 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED') {
  if (status === 'ACTIVE') return 'Còn hiệu lực';
  if (status === 'USED') return 'Đã sử dụng';
  if (status === 'EXPIRED') return 'Đã hết hạn';
  return 'Đã thu hồi';
}

export function eurohouseAccessErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('TRANSFER_REQUIRES_ADMIN')) return 'Cơ sở đang thuộc NPP khác. Chỉ Admin Eurohouse có thể chuyển NPP quản lý.';
  if (message.includes('SEARCH_TERM_TOO_SHORT')) return 'Nhập đầy đủ email hoặc số điện thoại để tìm chính xác.';
  if (message.includes('INVALID_IDENTIFIER')) return 'Email hoặc số điện thoại chưa đúng định dạng.';
  if (message.includes('REVOKE_REASON_REQUIRED')) return 'Vui lòng ghi lý do thu hồi quyền.';
  return message || 'Không thể cập nhật quyền Eurohouse.';
}

export function workspaceLayout(width: number): 'STACKED' | 'SPLIT' {
  return width <= 1024 ? 'STACKED' : 'SPLIT';
}
