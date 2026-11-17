import type { FormulaCapability } from '@eurohouse/types';

export type FormulaUiState = {
  showLockedScreen: boolean;
  statusLabel: 'Chưa kích hoạt' | 'Đã kích hoạt' | 'Đã thu hồi';
  message: string;
  manualQuotationEnabled: true;
  manualOrderEnabled: true;
};

const LOCKED_CAPABILITY: FormulaCapability = {
  status: 'LOCKED',
  enabled: false,
  message: 'Module đang xây dựng',
};

export function canCallFormulaApi(capability?: FormulaCapability): boolean {
  return capability?.status === 'ACTIVE' && capability.enabled === true;
}

export function formulaUiState(capability?: FormulaCapability): FormulaUiState {
  const current = capability ?? LOCKED_CAPABILITY;
  return {
    showLockedScreen: !canCallFormulaApi(current),
    statusLabel: current.status === 'ACTIVE' ? 'Đã kích hoạt' : current.status === 'REVOKED' ? 'Đã thu hồi' : 'Chưa kích hoạt',
    message: current.status === 'LOCKED' ? 'Module đang xây dựng' : current.message,
    manualQuotationEnabled: true,
    manualOrderEnabled: true,
  };
}

export async function guardFormulaCall<T>(capability: FormulaCapability | undefined, operation: () => Promise<T>): Promise<T> {
  if (!canCallFormulaApi(capability)) throw new Error('FORMULA_ACCESS_REQUIRED');
  return operation();
}
