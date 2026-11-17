export function formatVndInput(value: string | number) {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  const normalized = digits.replace(/^0+(?=\d)/, '');
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseVndInput(value: string | number) {
  const digits = String(value).replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}
