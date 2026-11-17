export function reconcileOpenCatalogSystem(currentSystemId, visibleSystemIds) {
  if (!currentSystemId) return null;
  return visibleSystemIds.includes(currentSystemId) ? currentSystemId : null;
}

export function shouldShowOrderSummary(selectedLineCount) {
  return selectedLineCount > 0;
}
