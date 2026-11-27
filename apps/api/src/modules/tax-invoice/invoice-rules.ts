// Tính tổng và kiểm tra hoá đơn trước khi phát hành: hàm thuần (tax-ledger.spec.ts).

export interface InvoiceLineAmountInput {
  quantity: number;
  unitPrice: number;
}

export function lineAmount(line: InvoiceLineAmountInput): number {
  return Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
}

export function computeInvoiceTotals(lines: InvoiceLineAmountInput[], vatRatePct: number) {
  const amounts = lines.map(lineAmount);
  const subtotal = amounts.reduce((s, a) => s + a, 0);
  const vatAmount = Math.round((subtotal * (Number(vatRatePct) || 0)) / 100);
  return { amounts, subtotal, vatAmount, total: subtotal + vatAmount };
}

/** Mã số thuế VN: 10 chữ số, hoặc 13 (có thể viết 10 số - 3 số của chi nhánh). */
export function isValidTaxCode(value: string): boolean {
  return /^\d{10}(\d{3})?$/.test(value.replace(/[-\s]/g, ''));
}

export function validateForIssue(
  invoice: { buyerName: string; buyerTaxCode: string; lines: Array<{ name: string; quantity: number; unitPrice: number }> },
  profile: { taxCode: string; legalName: string; invoiceSeries: string },
): string[] {
  const errors: string[] = [];
  if (!profile.taxCode.trim()) errors.push('Chưa có mã số thuế của xưởng trong hồ sơ thuế.');
  if (!profile.legalName.trim()) errors.push('Chưa có tên đăng ký kinh doanh trong hồ sơ thuế.');
  if (!profile.invoiceSeries.trim()) errors.push('Chưa có ký hiệu hoá đơn trong hồ sơ thuế.');
  if (!invoice.buyerName.trim()) errors.push('Thiếu tên người mua.');
  if (invoice.buyerTaxCode.trim() && !isValidTaxCode(invoice.buyerTaxCode.trim())) errors.push('Mã số thuế người mua phải có 10 hoặc 13 chữ số.');
  if (!invoice.lines.length) errors.push('Hoá đơn cần ít nhất một dòng hàng.');
  invoice.lines.forEach((line, i) => {
    if (!line.name.trim()) errors.push(`Dòng ${i + 1}: thiếu tên hàng hoá, dịch vụ.`);
    if (!(Number(line.quantity) > 0)) errors.push(`Dòng ${i + 1}: số lượng phải lớn hơn 0.`);
    if (!Number.isFinite(Number(line.unitPrice))) errors.push(`Dòng ${i + 1}: đơn giá không hợp lệ.`);
  });
  if (invoice.lines.reduce((s, l) => s + lineAmount(l), 0) < 0) errors.push('Tổng tiền hoá đơn không được âm.');
  return errors;
}
