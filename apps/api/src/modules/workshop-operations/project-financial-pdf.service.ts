import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  PDF_COLORS,
  addPdfPageFooters,
  formatDecimal,
  formatMoney,
  formatPdfDate,
  loadPdfLogo,
  moneyInWords,
  type PdfIssuerProfile,
  registerPdfFonts,
} from '../../common/pdf-document.util';

export interface ProjectFinancialTransaction {
  code: string;
  type: string;
  amount: number;
  method: string;
  category: string;
  partnerName: string;
  note: string;
  transDate: Date | string;
}

export interface ProjectFinancialPdfData {
  code: string;
  name: string;
  customerName: string;
  customerPhone: string;
  address: string;
  status: string;
  quotationId?: string | null;
  contractValue: number;
  estimatedValue: number;
  incurredValue: number;
  incurredType: string;
  settledValue: number;
  extraRevenue: number;
  costAluminum: number;
  costAccessory: number;
  costLockHinge: number;
  costGlass: number;
  costGasket: number;
  costSilicone: number;
  costScrew: number;
  costLabor: number;
  costConsumables: number;
  costTransport: number;
  costInstallation: number;
  costPartnerPct: number;
  costOther: number;
  note: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  customCosts?: Array<{ category: string; label: string; amount: number; note?: string }>;
  transactions?: ProjectFinancialTransaction[];
  issuer?: PdfIssuerProfile | null;
}

interface AmountRow {
  label: string;
  note: string;
  amount: number;
}

const PAGE_MARGIN = 30;
const FOOTER_RESERVE = 45;

@Injectable()
export class ProjectFinancialPdfService {
  async render(project: ProjectFinancialPdfData): Promise<Buffer> {
    const logo = await loadPdfLogo(project.issuer || undefined);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: PAGE_MARGIN,
        bufferPages: true,
        info: {
          Title: `Tổng hợp thu chi công trình ${project.code}`,
          Author: project.issuer?.productionName || project.issuer?.name || 'EUROHOUSE Workshop OS',
          Subject: `${project.name} - ${project.customerName}`,
          Creator: 'EUROHOUSE Workshop OS',
        },
      });
      registerPdfFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const left = PAGE_MARGIN;
      const width = doc.page.width - PAGE_MARGIN * 2;
      const right = left + width;
      const bottom = () => doc.page.height - FOOTER_RESERVE;
      const issuerName = project.issuer?.productionName || project.issuer?.name || 'CƠ SỞ SẢN XUẤT NHÔM KÍNH';
      const statusLabel = ({ OPEN: 'Mới', IN_PROGRESS: 'Đang thi công', DONE: 'Hoàn thành', CANCELLED: 'Đã hủy' } as Record<string, string>)[project.status] || project.status;

      const initialSettlement = project.settledValue || project.contractValue || Math.max(
        0,
        project.estimatedValue + (project.incurredType === 'DECREASE' ? -project.incurredValue : project.incurredValue),
      );
      const totalRevenue = initialSettlement + (project.extraRevenue || 0);
      const partnerCost = Math.round((totalRevenue * (project.costPartnerPct || 0)) / 100);
      const expenseRows: AmountRow[] = [
        { label: 'Nhôm', note: 'Vật tư nhôm chính', amount: project.costAluminum },
        { label: 'Phụ kiện', note: 'Phụ kiện đồng bộ', amount: project.costAccessory },
        { label: 'Khóa và bản lề', note: 'Khóa, bản lề, tay nắm', amount: project.costLockHinge },
        { label: 'Kính', note: 'Kính và gia công kính', amount: project.costGlass },
        { label: 'Gioăng', note: 'Gioăng và vật tư làm kín', amount: project.costGasket },
        { label: 'Silicone', note: 'Keo silicone', amount: project.costSilicone },
        { label: 'Vít', note: 'Vít và liên kết', amount: project.costScrew },
        { label: 'Nhân công xưởng', note: 'Sản xuất tại xưởng', amount: project.costLabor },
        { label: 'Vật tư phụ', note: 'Vật tư tiêu hao', amount: project.costConsumables },
        { label: 'Vận chuyển', note: 'Giao nhận và vận chuyển', amount: project.costTransport },
        { label: 'Lắp đặt', note: 'Nhân công lắp đặt', amount: project.costInstallation },
        { label: 'Chi phí đối tác', note: `${formatDecimal(project.costPartnerPct, 1)}% doanh thu`, amount: partnerCost },
        { label: 'Chi phí khác', note: 'Chi phí khác đã phân bổ', amount: project.costOther },
        ...(project.customCosts || []).map((cost) => ({ label: cost.label || cost.category, note: cost.note || cost.category, amount: cost.amount })),
      ].filter((row) => Number(row.amount) !== 0);
      const totalExpense = expenseRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const profit = totalRevenue - totalExpense;
      const profitPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
      const transactions = project.transactions || [];
      const receiptTotal = transactions.filter((item) => item.type === 'RECEIPT').reduce((sum, item) => sum + item.amount, 0);
      const paymentTotal = transactions.filter((item) => item.type === 'PAYMENT').reduce((sum, item) => sum + item.amount, 0);
      const netCash = receiptTotal - paymentTotal;

      const drawHeader = (continuation = false) => {
        const top = PAGE_MARGIN;
        if (continuation) {
          doc.font('bold').fontSize(9.5).fillColor(PDF_COLORS.ink).text(issuerName, left, top, { width: width * 0.58 });
          doc.font('bold').fontSize(9.5).fillColor(PDF_COLORS.orange)
            .text(`TỔNG HỢP THU CHI - ${project.code} (tiếp theo)`, left, top, { width, align: 'right' });
          doc.moveTo(left, top + 19).lineTo(right, top + 19).lineWidth(1).strokeColor(PDF_COLORS.orange).stroke();
          return top + 30;
        }
        doc.rect(left, top, width, 72).fill(PDF_COLORS.ink);
        let textX = left + 16;
        if (logo) {
          try {
            doc.image(logo, textX, top + 9, { fit: [52, 52] });
            textX += 64;
          } catch {
            // Ignore unsupported organization logos without blocking report export.
          }
        }
        doc.font('bold').fontSize(12.5).fillColor(PDF_COLORS.white).text(issuerName.toUpperCase(), textX, top + 11, { width: width * 0.52 });
        doc.font('body').fontSize(7.8).fillColor('#D0D5DD')
          .text(project.issuer?.mainCategories || '', textX, top + 31, { width: width * 0.54, lineBreak: false, ellipsis: true })
          .text([project.issuer?.address, project.issuer?.phone, project.issuer?.email, project.issuer?.fanpage].filter(Boolean).join(' | '), textX, top + 45, { width: width * 0.54, lineBreak: false, ellipsis: true });
        doc.font('bold').fontSize(15).fillColor(PDF_COLORS.orange).text('BẢNG TỔNG HỢP THU CHI', left + width * 0.55, top + 10, { width: width * 0.42, align: 'right' });
        doc.font('body').fontSize(8).fillColor(PDF_COLORS.white)
          .text(`Mã công trình: ${project.code}`, left + width * 0.55, top + 37, { width: width * 0.42, align: 'right' })
          .text(`Ngày xuất: ${formatPdfDate(new Date())}`, left + width * 0.55, top + 51, { width: width * 0.42, align: 'right' });
        return top + 84;
      };

      const ensureSpace = (cursor: number, needed: number) => {
        if (cursor + needed <= bottom()) return cursor;
        doc.addPage();
        return drawHeader(true);
      };

      let y = drawHeader();
      doc.roundedRect(left, y, width, 75, 6).fillAndStroke(PDF_COLORS.soft, PDF_COLORS.line);
      doc.font('bold').fontSize(11).fillColor(PDF_COLORS.ink).text(project.name || 'Công trình', left + 12, y + 10, { width: width * 0.58 });
      doc.font('body').fontSize(8.3).fillColor(PDF_COLORS.text)
        .text(`Khách hàng: ${project.customerName || '-'}`, left + 12, y + 31, { width: width * 0.48 })
        .text(`Điện thoại: ${project.customerPhone || '-'}`, left + 12, y + 47, { width: width * 0.48 })
        .text(`Địa chỉ: ${project.address || '-'}`, left + 12, y + 62, { width: width * 0.7, lineBreak: false, ellipsis: true });
      doc.font('bold').fontSize(8.2).fillColor(PDF_COLORS.orange)
        .text('BÁO CÁO QUẢN TRỊ', left + width * 0.72, y + 13, { width: width * 0.25, align: 'right' });
      doc.font('body').fontSize(8).fillColor(PDF_COLORS.muted)
        .text(`Trạng thái: ${statusLabel}`, left + width * 0.62, y + 35, { width: width * 0.35, align: 'right' })
        .text(`Báo giá liên kết: ${project.quotationId || '-'}`, left + width * 0.62, y + 51, { width: width * 0.35, align: 'right' });
      y += 87;

      const cardGap = 7;
      const cardWidth = (width - cardGap * 3) / 4;
      const cards = [
        { label: 'TỔNG DOANH THU', value: formatMoney(totalRevenue), color: PDF_COLORS.orange },
        { label: 'TỔNG CHI PHÍ', value: formatMoney(totalExpense), color: PDF_COLORS.text },
        { label: 'LỢI NHUẬN', value: formatMoney(profit), color: profit >= 0 ? PDF_COLORS.green : PDF_COLORS.red },
        { label: 'TỶ SUẤT', value: `${formatDecimal(profitPct, 1)}%`, color: profit >= 0 ? PDF_COLORS.green : PDF_COLORS.red },
      ];
      cards.forEach((card, index) => {
        const x = left + index * (cardWidth + cardGap);
        doc.roundedRect(x, y, cardWidth, 54, 5).fillAndStroke(index === 0 ? PDF_COLORS.orangeSoft : PDF_COLORS.soft, PDF_COLORS.line);
        doc.font('bold').fontSize(7.2).fillColor(PDF_COLORS.muted).text(card.label, x + 8, y + 9, { width: cardWidth - 16 });
        doc.font('bold').fontSize(11.5).fillColor(card.color).text(card.value, x + 8, y + 27, { width: cardWidth - 16, lineBreak: false, ellipsis: true });
      });
      y += 68;

      const drawSectionTitle = (title: string, cursor: number) => {
        doc.rect(left, cursor, 4, 16).fill(PDF_COLORS.orange);
        doc.font('bold').fontSize(10).fillColor(PDF_COLORS.ink).text(title, left + 10, cursor + 1, { width: width - 10 });
        return cursor + 24;
      };

      const drawAmountTable = (rows: AmountRow[], cursor: number, totalLabel: string, total: number) => {
        const colWidths = [34, 176, 200, 125];
        const xs = [left];
        colWidths.forEach((cellWidth) => xs.push(xs[xs.length - 1] + cellWidth));
        const cellFont = (header: boolean, totalRow: boolean) => doc.font(header || totalRow ? 'bold' : 'body').fontSize(header ? 7.6 : 8);
        const rowHeightFor = (values: string[], header: boolean, totalRow: boolean) => {
          cellFont(header, totalRow);
          const textHeight = Math.max(...values.map((value, index) => doc.heightOfString(value || ' ', { width: colWidths[index] - 8 })));
          return Math.max(header ? 24 : totalRow ? 34 : 22, Math.ceil(textHeight) + 12);
        };
        const drawRow = (values: string[], rowY: number, header = false, totalRow = false) => {
          const height = rowHeightFor(values, header, totalRow);
          doc.rect(left, rowY, width, height).fillAndStroke(header ? PDF_COLORS.ink : totalRow ? PDF_COLORS.orangeSoft : PDF_COLORS.white, PDF_COLORS.line);
          values.forEach((value, index) => {
            doc.font(header || totalRow ? 'bold' : 'body').fontSize(header ? 7.6 : 8).fillColor(header ? PDF_COLORS.white : totalRow ? PDF_COLORS.orange : PDF_COLORS.text)
              .text(value, xs[index] + 4, rowY + 6, { width: colWidths[index] - 8, align: index === 3 ? 'right' : index === 0 ? 'center' : 'left' });
            if (index > 0) doc.moveTo(xs[index], rowY).lineTo(xs[index], rowY + height).lineWidth(0.35).strokeColor(PDF_COLORS.line).stroke();
          });
          return rowY + height;
        };
        const tableHeaders = ['STT', 'Khoản mục', 'Diễn giải', 'Số tiền'];
        cursor = drawRow(tableHeaders, cursor, true);
        rows.forEach((row, index) => {
          if (cursor + rowHeightFor([String(index + 1), row.label, row.note, formatMoney(row.amount)], false, false) + 24 > bottom()) {
            doc.addPage();
            cursor = drawHeader(true);
            cursor = drawRow(tableHeaders, cursor, true);
          }
          cursor = drawRow([String(index + 1), row.label, row.note, formatMoney(row.amount)], cursor);
        });
        if (cursor + 34 > bottom()) {
          doc.addPage();
          cursor = drawHeader(true);
          cursor = drawRow(tableHeaders, cursor, true);
        }
        cursor = drawRow(['', totalLabel, moneyInWords(total), formatMoney(total)], cursor, false, true);
        return cursor + 10;
      };

      y = drawSectionTitle('1. TỔNG HỢP DOANH THU', y);
      const revenueBase = project.contractValue || project.estimatedValue;
      const settlementAdjustment = initialSettlement - revenueBase;
      const revenueRows: AmountRow[] = [
        { label: 'Giá trị hợp đồng / dự toán', note: project.quotationId ? `Theo báo giá ${project.quotationId}` : 'Giá trị cơ sở', amount: revenueBase },
        ...(settlementAdjustment ? [{ label: settlementAdjustment < 0 ? 'Điều chỉnh giảm' : 'Điều chỉnh tăng', note: 'Chênh lệch khi quyết toán công trình', amount: settlementAdjustment }] : []),
        ...(project.extraRevenue ? [{ label: 'Doanh thu bổ sung', note: 'Khoản thu bổ sung ngoài quyết toán', amount: project.extraRevenue }] : []),
      ];
      y = drawAmountTable(revenueRows, y, 'TỔNG DOANH THU GHI NHẬN', totalRevenue);
      y = ensureSpace(y, 90);
      y = drawSectionTitle('2. TỔNG HỢP CHI PHÍ', y);
      y = drawAmountTable(expenseRows.length ? expenseRows : [{ label: 'Chưa ghi nhận', note: 'Chưa có dữ liệu chi phí', amount: 0 }], y, 'TỔNG CHI PHÍ', totalExpense);

      y = ensureSpace(y, 115);
      y = drawSectionTitle('3. KẾT QUẢ VÀ DÒNG TIỀN', y);
      const resultRows: AmountRow[] = [
        { label: 'Lợi nhuận dự kiến', note: `Tỷ suất ${formatDecimal(profitPct, 1)}%`, amount: profit },
        { label: 'Tiền đã thu', note: `${transactions.filter((item) => item.type === 'RECEIPT').length} phiếu thu`, amount: receiptTotal },
        { label: 'Tiền đã chi', note: `${transactions.filter((item) => item.type === 'PAYMENT').length} phiếu chi`, amount: -paymentTotal },
      ];
      y = drawAmountTable(resultRows, y, 'DÒNG TIỀN THUẦN', netCash);

      if (transactions.length) {
        y = ensureSpace(y, 80);
        y = drawSectionTitle('4. CHI TIẾT PHIẾU THU - CHI', y);
        const colWidths = [30, 58, 48, 88, 96, 132, 83];
        const xs = [left];
        colWidths.forEach((cellWidth) => xs.push(xs[xs.length - 1] + cellWidth));
        const headers = ['STT', 'Ngày', 'Loại', 'Số phiếu', 'Khoản mục', 'Đối tượng / Ghi chú', 'Số tiền'];
        const drawTransactionHeader = (cursor: number) => {
          doc.rect(left, cursor, width, 26).fill(PDF_COLORS.ink);
          headers.forEach((header, index) => doc.font('bold').fontSize(7).fillColor(PDF_COLORS.white)
            .text(header, xs[index] + 3, cursor + 7, { width: colWidths[index] - 6, align: index === 6 ? 'right' : 'center', lineBreak: false }));
          return cursor + 26;
        };
        y = drawTransactionHeader(y);
        transactions.forEach((transaction, index) => {
          const values = [
            String(index + 1), formatPdfDate(transaction.transDate), transaction.type === 'RECEIPT' ? 'Thu' : 'Chi',
            transaction.code, transaction.category || '-', [transaction.partnerName, transaction.note].filter(Boolean).join(' - ') || '-',
            formatMoney(transaction.type === 'PAYMENT' ? -transaction.amount : transaction.amount),
          ];
          const rowHeight = Math.max(25, Math.ceil(Math.max(...values.map((value, cellIndex) =>
            doc.font(cellIndex === 6 ? 'bold' : 'body').fontSize(7.4).heightOfString(value, { width: colWidths[cellIndex] - 6 })))) + 14);
          if (y + rowHeight > bottom()) {
            doc.addPage();
            y = drawHeader(true);
            y = drawTransactionHeader(y);
          }
          doc.rect(left, y, width, rowHeight).fillAndStroke(PDF_COLORS.white, PDF_COLORS.line);
          values.forEach((value, cellIndex) => doc.font(cellIndex === 6 ? 'bold' : 'body').fontSize(7.4)
            .fillColor(cellIndex === 6 ? (transaction.type === 'RECEIPT' ? PDF_COLORS.green : PDF_COLORS.red) : PDF_COLORS.text)
            .text(value, xs[cellIndex] + 3, y + 7, { width: colWidths[cellIndex] - 6, align: cellIndex === 6 ? 'right' : cellIndex === 0 ? 'center' : 'left' }));
          y += rowHeight;
        });
        y += 12;
      }

      y = ensureSpace(y, 105);
      doc.roundedRect(left, y, width, project.note ? 48 : 34, 5).fillAndStroke(PDF_COLORS.soft, PDF_COLORS.line);
      doc.font('bold').fontSize(8.5).fillColor(PDF_COLORS.ink).text('Ghi chú quản trị:', left + 10, y + 9, { continued: true });
      doc.font('body').fillColor(PDF_COLORS.text).text(` ${project.note || 'Số liệu được tổng hợp từ dữ liệu công trình tại thời điểm xuất báo cáo.'}`, { width: width - 115 });
      y += project.note ? 60 : 46;
      y = ensureSpace(y, 75);
      const signatureWidth = width / 3;
      ['NGƯỜI LẬP', 'PHỤ TRÁCH CÔNG TRÌNH', 'CHỦ CƠ SỞ'].forEach((label, index) => {
        doc.font('bold').fontSize(8.5).fillColor(PDF_COLORS.ink).text(label, left + index * signatureWidth, y, { width: signatureWidth, align: 'center' });
        doc.font('body').fontSize(7.2).fillColor(PDF_COLORS.muted).text('(Ký, ghi rõ họ tên)', left + index * signatureWidth, y + 14, { width: signatureWidth, align: 'center' });
      });

      addPdfPageFooters(doc, project.code, issuerName);
      doc.end();
    });
  }
}
