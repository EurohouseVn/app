function normalizeSystemCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeSystemName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isCuttingFormulaSystemVisible(system) {
  const code = normalizeSystemCode(system.code);
  const name = normalizeSystemName(system.name);
  return code !== 'EUPRECO' && !/(^|\s)preco($|\s)/.test(name);
}

export function filterCuttingFormulaSystems(systems) {
  return systems.filter(isCuttingFormulaSystemVisible);
}
