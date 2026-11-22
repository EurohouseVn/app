export type FormulaStatus = 'LOCKED' | 'ACTIVE' | 'REVOKED';
export type WorkshopRelationship = 'UNASSIGNED' | 'MANAGED' | 'OTHER_NPP';

export type WorkshopSearchResult = {
  organizationId: string;
  organizationName: string;
  province?: string;
  maskedEmail?: string;
  maskedPhone?: string;
  relationship: WorkshopRelationship;
  status: FormulaStatus;
};

export type FormulaAccessState = {
  results: WorkshopSearchResult[];
  selected?: WorkshopSearchResult;
  oneTimeCode?: string;
  oneTimeCodeExpiresAt?: string;
};

export function createFormulaAccessState(): FormulaAccessState {
  return { results: [] };
}

export function setSearchResults(state: FormulaAccessState, results: WorkshopSearchResult[]): FormulaAccessState {
  const safeResults = results.map(({ organizationId, organizationName, province, maskedEmail, maskedPhone, relationship, status }) => ({
    organizationId,
    organizationName,
    province,
    maskedEmail,
    maskedPhone,
    relationship,
    status,
  }));
  const selected = state.selected ? safeResults.find((row) => row.organizationId === state.selected?.organizationId) : undefined;
  return { ...state, results: safeResults, selected };
}

export function selectWorkshop(state: FormulaAccessState, organizationId: string): FormulaAccessState {
  return {
    ...state,
    selected: state.results.find((row) => row.organizationId === organizationId),
    oneTimeCode: undefined,
    oneTimeCodeExpiresAt: undefined,
  };
}

export function setCreatedInvite(state: FormulaAccessState, invite: { plainCode: string; expiresAt: string }): FormulaAccessState {
  return { ...state, oneTimeCode: invite.plainCode, oneTimeCodeExpiresAt: invite.expiresAt };
}

export function statusLabel(status: FormulaStatus) {
  return status === 'ACTIVE' ? 'Đã kích hoạt' : status === 'REVOKED' ? 'Đã thu hồi' : 'Chưa kích hoạt';
}

export function inviteStatusLabel(status: 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED') {
  if (status === 'ACTIVE') return 'Còn hiệu lực';
  if (status === 'USED') return 'Đã sử dụng';
  if (status === 'EXPIRED') return 'Đã hết hạn';
  return 'Đã thu hồi';
}

export function formulaAccessErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('TRANSFER_REQUIRES_ADMIN')) return 'Cơ sở đang thuộc NPP khác. Chỉ Admin Eurohouse có thể chuyển NPP quản lý.';
  if (message.includes('SEARCH_TERM_TOO_SHORT')) return 'Nhập đầy đủ email hoặc số điện thoại để tìm chính xác.';
  if (message.includes('INVALID_IDENTIFIER')) return 'Email hoặc số điện thoại chưa đúng định dạng.';
  return message || 'Không thể cập nhật quyền Công thức Eurohouse.';
}
