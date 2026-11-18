// PDF hoá đơn (bản Bản thử hoặc phiếu tóm tắt cho hoá đơn ghi số ngoài) và file Excel báo cáo thuế.
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as exceljs from 'exceljs';
import type { WorkshopSalesInvoice, WorkshopTaxProfile } from '@eurohouse/types';
import { PDF_COLORS, addPdfPageFooters, moneyInWords, registerPdfFonts } from '../../common/pdf-document.util';
import { vnDateKey } from './tax-ledger';

export const TAX_DISCLAIMER = 'Số liệu do app tổng hợp để tham khảo. Hộ kinh doanh chịu trách nhiệm số khai thuế; nên nhờ kế toán xác nhận tỷ lệ % theo ngành.';

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Nháp', ISSUED: 'Đã phát hành', CANCELLED: 'Đã huỷ', REPLACED: 'Đã bị thay thế' };

function vi(value: number): string {
  return Math.round(value).toLocaleString('vi-VN');
}

function qty(value: number): string {
  return Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}

function dmy(key: string): string {
  const [y, m, d] = key.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export interface InvoicePdfData {
  invoice: WorkshopSalesInvoice;
  profile: WorkshopTaxProfile;
  organization: { name?: string; address?: string | null; phone?: string | null } | null;
}

export interface TaxReportData {
  year: number;
  profile: WorkshopTaxProfile;
  organizationName: string;
  invoices: Array<{ issueDate: Date; series: string; number: string | null; status: string; source: string; provider: string | null; buyerName: string; buyerTaxCode: string; projectCode: string; subtotal: number; vatAmount: number; total: number; cancelReason: string; replaces: { number: string | null } | null; lines: Array<{ name: string }> }>;
  receipts: Array<{ transDate: Date; code: string; amount: number; method: string; partnerName: string; note: string; project: { code: string; name: string } | null }>;
}

@Injectable()
export class InvoiceDocumentsService {
  renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
    const { invoice, profile } = data;
    const sandbox = invoice.provider === 'SANDBOX';
    const isHkd = profile.entityType === 'HKD';
    const sellerName = profile.legalName || data.organization?.name || 'Cơ sở sản xuất nhôm kính';
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true, info: { Title: `Hoá đơn ${invoice.series} ${invoice.number ?? 'nháp'}` } });
      registerPdfFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const left = 44;
      const width = doc.page.width - 88;
      const bottom = doc.page.height - 60;

      if (sandbox || invoice.status === 'DRAFT') {
        doc.save();
        doc.rotate(-28, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.font('bold').fontSize(54).fillColor('#7A5AF8').opacity(0.1)
          .text(invoice.status === 'DRAFT' ? 'BẢN NHÁP' : 'BẢN THỬ', 0, doc.page.height / 2 - 40, { width: doc.page.width, align: 'center' });
        doc.restore();
        doc.opacity(1);
      }

      // Người bán
      doc.font('bold').fontSize(11).fillColor(PDF_COLORS.ink).text(sellerName.toUpperCase(), left, 40, { width });
      const sellerLines = [
        profile.taxCode ? `Mã số thuế: ${profile.taxCode}${profile.locationCode ? ` · Mã địa điểm: ${profile.locationCode}` : ''}` : '',
        profile.legalAddress || data.organization?.address || '',
        data.organization?.phone ? `Điện thoại: ${data.organization.phone}` : '',
      ].filter(Boolean);
      doc.font('body').fontSize(8.4).fillColor(PDF_COLORS.muted).text(sellerLines.join('\n'), left, 57, { width });

      // Tiêu đề
      let y = 112;
      const title = isHkd ? 'HOÁ ĐƠN BÁN HÀNG' : 'HOÁ ĐƠN GIÁ TRỊ GIA TĂNG';
      doc.font('bold').fontSize(17).fillColor(PDF_COLORS.ink).text(title, left, y, { width, align: 'center' });
      y += 24;
      const ident = invoice.number ? `Ký hiệu: ${invoice.series} · Số: ${invoice.number}` : 'Chưa phát hành, chưa có số';
      doc.font('body').fontSize(9).fillColor(PDF_COLORS.text).text(`Ngày ${dmy(invoice.issueDate)} · ${ident}`, left, y, { width, align: 'center' });
      y += 14;
      if (invoice.lookupCode) {
        doc.font('body').fontSize(8.4).fillColor(PDF_COLORS.muted).text(`Mã tra cứu: ${invoice.lookupCode}`, left, y, { width, align: 'center' });
        y += 13;
      }
      if (invoice.replacesNumber) {
        doc.font('body').fontSize(8.4).fillColor(PDF_COLORS.muted).text(`Thay thế cho hoá đơn số ${invoice.replacesNumber}`, left, y, { width, align: 'center' });
        y += 13;
      }
      y += 8;

      // Người mua
      const buyer: Array<[string, string]> = [
        ['Người mua', invoice.buyerName],
        ...(invoice.buyerTaxCode ? [['Mã số thuế', invoice.buyerTaxCode] as [string, string]] : []),
        ...(invoice.buyerAddress ? [['Địa chỉ', invoice.buyerAddress] as [string, string]] : []),
        ...(invoice.projectCode ? [['Công trình', invoice.projectCode] as [string, string]] : []),
      ];
      const boxH = 12 + buyer.length * 17;
      doc.roundedRect(left, y, width, boxH, 6).fillAndStroke(PDF_COLORS.soft, PDF_COLORS.line);
      buyer.forEach(([k, v], i) => {
        doc.font('bold').fontSize(8.5).fillColor(PDF_COLORS.muted).text(k, left + 12, y + 8 + i * 17, { width: 90 });
        doc.font('body').fontSize(9).fillColor(PDF_COLORS.text).text(v, left + 105, y + 8 + i * 17, { width: width - 117, lineBreak: false, ellipsis: true });
      });
      y += boxH + 14;

      // Bảng hàng
      const cols = [
        { label: 'STT', w: 30, align: 'center' as const },
        { label: 'Tên hàng hoá, dịch vụ', w: width - 30 - 44 - 56 - 86 - 96, align: 'left' as const },
        { label: 'ĐVT', w: 44, align: 'center' as const },
        { label: 'Số lượng', w: 56, align: 'right' as const },
        { label: 'Đơn giá', w: 86, align: 'right' as const },
        { label: 'Thành tiền', w: 96, align: 'right' as const },
      ];
      const header = () => {
        doc.rect(left, y, width, 22).fill(PDF_COLORS.ink);
        let x = left;
        for (const c of cols) {
          doc.font('bold').fontSize(8.2).fillColor(PDF_COLORS.white).text(c.label, x + 5, y + 7, { width: c.w - 10, align: c.align });
          x += c.w;
        }
        y += 22;
      };
      header();
      invoice.lines.forEach((line, i) => {
        const h = Math.max(20, doc.font('body').fontSize(8.8).heightOfString(line.name, { width: cols[1].w - 10 }) + 9);
        if (y + h > bottom - 120) { doc.addPage(); y = 50; header(); }
        const cells = [String(i + 1), line.name, line.unit, qty(line.quantity), vi(line.unitPrice), vi(line.amount)];
        let x = left;
        cells.forEach((cell, ci) => {
          doc.font(ci === 5 ? 'bold' : 'body').fontSize(8.8).fillColor(PDF_COLORS.text).text(cell, x + 5, y + 5, { width: cols[ci].w - 10, align: cols[ci].align });
          x += cols[ci].w;
        });
        y += h;
        doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor(PDF_COLORS.line).stroke();
      });

      // Tổng
      y += 8;
      const totalRow = (label: string, value: string, bold = false) => {
        doc.font(bold ? 'bold' : 'body').fontSize(bold ? 10.5 : 9).fillColor(PDF_COLORS.ink)
          .text(label, left + width - 330, y, { width: 210, align: 'right' })
          .text(value, left + width - 116, y, { width: 116, align: 'right' });
        y += bold ? 18 : 15;
      };
      if (!isHkd) {
        totalRow('Cộng tiền hàng', vi(invoice.subtotal));
        totalRow(`Thuế GTGT ${invoice.vatRatePct}%`, vi(invoice.vatAmount));
      }
      totalRow('TỔNG TIỀN THANH TOÁN', `${vi(invoice.total)} đ`, true);
      doc.font('body').fontSize(8.6).fillColor(PDF_COLORS.muted).text(`Bằng chữ: ${moneyInWords(invoice.total)}`, left, y + 2, { width });
      y = doc.y + 14;

      // Ghi chú trạng thái
      const notes: string[] = [];
      if (sandbox) notes.push('BẢN THỬ: hoá đơn tạo bằng nhà cung cấp giả lập để chạy thử, KHÔNG CÓ GIÁ TRỊ PHÁP LÝ.');
      if (invoice.source === 'EXTERNAL') notes.push('Phiếu tóm tắt hoá đơn đã xuất ở hệ thống hoá đơn điện tử khác. Hoá đơn gốc có chữ ký số nằm ở hệ thống đó.');
      if (invoice.status === 'CANCELLED') notes.push(`ĐÃ HUỶ${invoice.cancelReason ? `: ${invoice.cancelReason}` : ''}.`);
      if (invoice.status === 'REPLACED') notes.push(`ĐÃ BỊ THAY THẾ bởi hoá đơn số ${invoice.replacedByNumber ?? ''}.`);
      if (invoice.note) notes.push(`Ghi chú: ${invoice.note}`);
      if (notes.length) {
        const h = doc.font('body').fontSize(8.6).heightOfString(notes.join('\n'), { width: width - 24 }) + 16;
        if (y + h > bottom) { doc.addPage(); y = 50; }
        doc.roundedRect(left, y, width, h, 6).fillAndStroke(sandbox ? '#F4F3FF' : PDF_COLORS.orangeSoft, PDF_COLORS.line);
        doc.font('body').fontSize(8.6).fillColor(PDF_COLORS.text).text(notes.join('\n'), left + 12, y + 8, { width: width - 24 });
        y += h + 14;
      }

      if (y + 70 > bottom) { doc.addPage(); y = 50; }
      const half = width / 2;
      doc.font('bold').fontSize(9.5).fillColor(PDF_COLORS.ink)
        .text('NGƯỜI MUA HÀNG', left, y, { width: half, align: 'center' })
        .text('NGƯỜI BÁN HÀNG', left + half, y, { width: half, align: 'center' });
      doc.font('body').fontSize(8).fillColor(PDF_COLORS.muted)
        .text('(Ký, ghi rõ họ tên)', left, y + 14, { width: half, align: 'center' })
        .text(invoice.source === 'PROVIDER' && !sandbox ? '(Ký số)' : '(Ký, ghi rõ họ tên)', left + half, y + 14, { width: half, align: 'center' });

      addPdfPageFooters(doc, `HD-${invoice.series}-${invoice.number ?? 'NHAP'}`, sellerName);
      doc.end();
    });
  }

  /** Sổ doanh thu bán hàng hoá, dịch vụ (mẫu S1a-HKD) cộng trang đối chiếu tiền thu. */
  async renderS1a(data: TaxReportData): Promise<Buffer> {
    const wb = new exceljs.Workbook();
    wb.creator = 'Eurohouse';
    const name = data.profile.legalName || data.organizationName;
    const sheet = wb.addWorksheet('S1a-HKD', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    sheet.columns = [{ width: 13 }, { width: 18 }, { width: 13 }, { width: 58 }, { width: 18 }];
    sheet.addRow([`HỘ, CÁ NHÂN KINH DOANH: ${name}`]).font = { bold: true };
    sheet.addRow([`Mã số thuế: ${data.profile.taxCode || '(chưa khai)'}`]);
    sheet.addRow([`Địa chỉ: ${data.profile.legalAddress}`]);
    sheet.addRow([]);
    const title = sheet.addRow(['SỔ DOANH THU BÁN HÀNG HOÁ, DỊCH VỤ']);
    title.font = { bold: true, size: 14 };
    sheet.mergeCells(`A${title.number}:E${title.number}`);
    title.alignment = { horizontal: 'center' };
    const sub = sheet.addRow([`Mẫu S1a-HKD · Năm ${data.year} · Đơn vị tính: đồng`]);
    sheet.mergeCells(`A${sub.number}:E${sub.number}`);
    sub.alignment = { horizontal: 'center' };
    sheet.addRow([]);
    const head = sheet.addRow(['Ngày ghi sổ', 'Số hiệu chứng từ', 'Ngày chứng từ', 'Diễn giải', 'Số tiền']);
    head.font = { bold: true };
    head.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } }; c.border = { bottom: { style: 'thin' } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });

    const issued = data.invoices.filter((i) => i.status === 'ISSUED');
    let quarter = 0;
    let quarterSum = 0;
    let yearSum = 0;
    const closeQuarter = () => {
      if (!quarter) return;
      const r = sheet.addRow(['', '', '', `Cộng quý ${quarter}`, quarterSum]);
      r.font = { bold: true };
    };
    for (const inv of issued) {
      const key = vnDateKey(inv.issueDate);
      const q = Math.ceil(Number(key.slice(5, 7)) / 3);
      if (q !== quarter) { closeQuarter(); quarter = q; quarterSum = 0; }
      const desc = [`Bán hàng cho ${inv.buyerName}`, inv.lines[0]?.name ? `(${inv.lines[0].name}${inv.lines.length > 1 ? ` và ${inv.lines.length - 1} dòng khác` : ''})` : '', inv.provider === 'SANDBOX' ? '[Bản thử]' : '']
        .filter(Boolean).join(' ');
      sheet.addRow([dmy(key), `${inv.series}-${inv.number}`, dmy(key), desc, inv.total]);
      quarterSum += inv.total;
      yearSum += inv.total;
    }
    closeQuarter();
    const total = sheet.addRow(['', '', '', `TỔNG CỘNG NĂM ${data.year}`, yearSum]);
    total.font = { bold: true };
    sheet.getColumn(5).numFmt = '#,##0';
    sheet.getColumn(4).alignment = { wrapText: true, vertical: 'top' };
    sheet.addRow([]);
    sheet.addRow([TAX_DISCLAIMER]).font = { italic: true, color: { argb: 'FF667085' } };

    const cash = wb.addWorksheet('Tiền thu (đối chiếu)');
    cash.columns = [
      { header: 'Ngày', width: 13 }, { header: 'Số phiếu thu', width: 20 }, { header: 'Công trình', width: 30 },
      { header: 'Người nộp', width: 24 }, { header: 'Hình thức', width: 14 }, { header: 'Ghi chú', width: 30 }, { header: 'Số tiền', width: 18 },
    ];
    cash.getRow(1).font = { bold: true };
    let cashSum = 0;
    for (const r of data.receipts) {
      cash.addRow([dmy(vnDateKey(r.transDate)), r.code, r.project ? `${r.project.code} · ${r.project.name}` : '', r.partnerName, r.method === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt', r.note, r.amount]);
      cashSum += r.amount;
    }
    cash.addRow(['', '', '', '', '', 'Tổng cộng', cashSum]).font = { bold: true };
    cash.getColumn(7).numFmt = '#,##0';

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /** Bảng kê hoá đơn bán ra, gồm cả hoá đơn đã huỷ hoặc bị thay thế. */
  async renderInvoiceList(data: TaxReportData, quarter?: number): Promise<Buffer> {
    const wb = new exceljs.Workbook();
    const label = quarter ? `Quý ${quarter}/${data.year}` : `Năm ${data.year}`;
    const sheet = wb.addWorksheet('Bảng kê');
    sheet.addRow([`BẢNG KÊ HOÁ ĐƠN BÁN RA · ${label}`]).font = { bold: true, size: 13 };
    sheet.addRow([`${data.profile.legalName || data.organizationName} · MST ${data.profile.taxCode || '(chưa khai)'}`]);
    sheet.addRow([]);
    const head = sheet.addRow(['STT', 'Ngày', 'Ký hiệu', 'Số', 'Người mua', 'MST người mua', 'Công trình', 'Tiền hàng', 'Thuế GTGT', 'Tổng tiền', 'Trạng thái', 'Ghi chú']);
    head.font = { bold: true };
    sheet.columns = [{ width: 6 }, { width: 12 }, { width: 11 }, { width: 11 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 15 }, { width: 13 }, { width: 15 }, { width: 16 }, { width: 34 }];
    const rows = data.invoices.filter((i) => !quarter || Math.ceil(Number(vnDateKey(i.issueDate).slice(5, 7)) / 3) === quarter);
    let sum = 0;
    rows.forEach((inv, i) => {
      const note = [
        inv.source === 'EXTERNAL' ? 'Xuất ở hệ thống khác' : inv.provider === 'SANDBOX' ? 'Bản thử' : '',
        inv.replaces?.number ? `Thay thế số ${inv.replaces.number}` : '',
        inv.cancelReason ? `Huỷ: ${inv.cancelReason}` : '',
      ].filter(Boolean).join(' · ');
      sheet.addRow([i + 1, dmy(vnDateKey(inv.issueDate)), inv.series, inv.number, inv.buyerName, inv.buyerTaxCode, inv.projectCode, inv.subtotal, inv.vatAmount, inv.total, STATUS_LABEL[inv.status] ?? inv.status, note]);
      if (inv.status === 'ISSUED') sum += inv.total;
    });
    sheet.addRow([]);
    sheet.addRow(['', '', '', '', 'Tổng hoá đơn đã phát hành (không tính huỷ, bị thay thế)', '', '', '', '', sum]).font = { bold: true };
    for (const col of [8, 9, 10]) sheet.getColumn(col).numFmt = '#,##0';
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}

