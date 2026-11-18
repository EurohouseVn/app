import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { WorkshopPayslip, WorkshopPayType } from '@eurohouse/types';
import {
  PDF_COLORS,
  addPdfPageFooters,
  formatPdfDate,
  loadPdfLogo,
  moneyInWords,
  registerPdfFonts,
  type PdfIssuerProfile,
} from '../../common/pdf-document.util';
import { viNumber } from './workforce.service';

export interface PayslipPdfData {
  month: string;
  closed: boolean;
  organizationName: string;
  basePayFormula: string;
  worker: { name: string; roleName: string; payType: WorkshopPayType; baseRate: number; phone?: string };
  payslip: WorkshopPayslip;
  issuer: PdfIssuerProfile | null;
}

const PAY_TYPE_LABEL: Record<WorkshopPayType, string> = {
  DAILY: 'Lương ngày',
  HOURLY: 'Lương giờ',
  MONTHLY: 'Lương tháng',
};

type Row = { label: string; detail?: string; amount: number; kind?: 'plus' | 'minus' | 'total' };

const money = (value: number) => `${viNumber(Math.round(value))} đ`;

function lastDayOfMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, '0');
}

@Injectable()
export class PayslipPdfService {
  async render(data: PayslipPdfData): Promise<Buffer> {
    const logo = await loadPdfLogo(data.issuer || undefined);
    const [year, monthNumber] = data.month.split('-');
    const slip = data.payslip;
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 44,
        bufferPages: true,
        info: { Title: `Phiếu lương ${monthNumber}/${year} - ${data.worker.name}` },
      });
      registerPdfFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const left = 44;
      const width = doc.page.width - 88;
      const bottom = doc.page.height - 52; // chân trang in ở height - 34
      const issuerName = data.issuer?.productionName || data.issuer?.name || data.organizationName || 'CƠ SỞ SẢN XUẤT NHÔM KÍNH';

      // Đầu phiếu
      if (logo) {
        try { doc.image(logo, left, 36, { fit: [48, 48] }); } catch { /* Bỏ qua logo lỗi. */ }
      }
      const x = logo ? left + 60 : left;
      doc.font('bold').fontSize(11).fillColor(PDF_COLORS.ink).text(issuerName.toUpperCase(), x, 38, { width: width - (x - left) });
      doc.font('body').fontSize(7.8).fillColor(PDF_COLORS.muted)
        .text([data.issuer?.address, data.issuer?.phone].filter(Boolean).join(' | '), x, 57, { width: width - (x - left) });
      doc.font('bold').fontSize(17).fillColor(PDF_COLORS.ink).text(`PHIẾU LƯƠNG THÁNG ${monthNumber}/${year}`, left, 100, { width, align: 'center' });
      doc.font('body').fontSize(8.6).fillColor(PDF_COLORS.muted)
        .text(`Kỳ lương 01/${monthNumber}/${year} – ${lastDayOfMonth(data.month)}/${monthNumber}/${year}${data.closed ? ' · Đã chốt' : ' · Tạm tính, chưa chốt'}`, left, 124, { width, align: 'center' });

      // Thông tin thợ
      let y = 150;
      const info: Array<[string, string]> = [
        ['Họ và tên', data.worker.name],
        ['Công việc', data.worker.roleName || 'Thợ sản xuất'],
        ['Hình thức lương', `${PAY_TYPE_LABEL[data.worker.payType]} · ${money(data.worker.baseRate)}`],
        ['Ngày công', `${viNumber(slip.workUnits)} công (${slip.fullDays} đủ · ${slip.halfDays} nửa · ${slip.paidLeaveDays} phép có lương)`],
      ];
      if (slip.unpaidLeaveDays || slip.absentDays) {
        info.push(['Nghỉ không lương / vắng', `${slip.unpaidLeaveDays} / ${slip.absentDays} ngày`]);
      }
      const infoHeight = 14 + info.length * 19;
      doc.roundedRect(left, y, width, infoHeight, 6).fillAndStroke(PDF_COLORS.soft, PDF_COLORS.line);
      info.forEach(([label, value], index) => {
        doc.font('bold').fontSize(8.5).fillColor(PDF_COLORS.muted).text(label, left + 12, y + 10 + index * 19, { width: 140 });
        doc.font('body').fontSize(9).fillColor(PDF_COLORS.text).text(value, left + 155, y + 10 + index * 19, { width: width - 167 });
      });
      y += infoHeight + 16;

      // Bảng khoản
      const amountWidth = 120;
      const labelWidth = width - amountWidth - 24;
      const ensureSpace = (height: number) => {
        if (y + height <= bottom) return;
        doc.addPage();
        y = 50;
      };
      const sectionTitle = (title: string) => {
        ensureSpace(26);
        doc.font('bold').fontSize(9).fillColor(PDF_COLORS.orange).text(title, left, y, { width, characterSpacing: 0.6 });
        y = doc.y + 4;
      };
      const drawRow = (row: Row) => {
        const labelHeight = doc.font(row.kind === 'total' ? 'bold' : 'body').fontSize(9.2).heightOfString(row.label, { width: labelWidth });
        const detailHeight = row.detail ? doc.font('body').fontSize(7.8).heightOfString(row.detail, { width: labelWidth }) + 2 : 0;
        const height = Math.max(20, labelHeight + detailHeight + 7);
        ensureSpace(height);
        if (row.kind === 'total') doc.rect(left, y, width, height).fill(PDF_COLORS.soft);
        doc.font(row.kind === 'total' ? 'bold' : 'body').fontSize(9.2).fillColor(PDF_COLORS.text).text(row.label, left + 10, y + 4, { width: labelWidth });
        if (row.detail) doc.font('body').fontSize(7.8).fillColor(PDF_COLORS.muted).text(row.detail, left + 10, y + 4 + labelHeight, { width: labelWidth });
        const sign = row.kind === 'minus' ? '−' : '';
        doc.font('bold').fontSize(9.4).fillColor(row.kind === 'minus' ? PDF_COLORS.red : PDF_COLORS.ink)
          .text(`${sign}${money(row.amount)}`, left + width - amountWidth - 10, y + 4, { width: amountWidth, align: 'right' });
        y += height;
        doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor(PDF_COLORS.line).stroke();
      };

      sectionTitle('THU NHẬP');
      drawRow({ label: 'Lương theo công', detail: data.basePayFormula, amount: slip.basePay });
      if (slip.overtimePay) drawRow({ label: 'Tăng ca', detail: `${viNumber(slip.overtimeHours)} giờ × ${viNumber(slip.overtimeHourlyRate)}`, amount: slip.overtimePay });
      if (slip.sundayPay) drawRow({ label: 'Phụ trội Chủ nhật', detail: `${viNumber(slip.sundayDays)} ngày`, amount: slip.sundayPay });
      if (slip.holidayPay) drawRow({ label: 'Phụ trội ngày lễ', detail: `${viNumber(slip.holidayDays)} ngày`, amount: slip.holidayPay });
      for (const piece of slip.pieces) {
        drawRow({ label: `Khoán: ${piece.label}`, detail: [piece.projectName, piece.date ? formatPdfDate(piece.date) : ''].filter(Boolean).join(' · ') || undefined, amount: piece.amount });
      }
      for (const bonus of slip.bonuses) {
        drawRow({ label: 'Thưởng', detail: [bonus.note, bonus.date ? formatPdfDate(bonus.date) : ''].filter(Boolean).join(' · ') || undefined, amount: bonus.amount });
      }
      drawRow({ label: 'Tổng thu nhập', amount: slip.gross, kind: 'total' });

      if (slip.deductions) {
        y += 10;
        sectionTitle('KHẤU TRỪ');
        if (slip.insuranceEmployee) drawRow({ label: 'Bảo hiểm (BHXH 8%, BHYT 1,5%, BHTN 1%)', detail: `10,5% × ${money(slip.insuranceSalary)}`, amount: slip.insuranceEmployee, kind: 'minus' });
        for (const advance of slip.advances) {
          drawRow({ label: 'Tạm ứng', detail: [advance.note, advance.date ? formatPdfDate(advance.date) : ''].filter(Boolean).join(' · ') || undefined, amount: advance.amount, kind: 'minus' });
        }
        for (const penalty of slip.penalties) {
          drawRow({ label: 'Phạt', detail: [penalty.note, penalty.date ? formatPdfDate(penalty.date) : ''].filter(Boolean).join(' · ') || undefined, amount: penalty.amount, kind: 'minus' });
        }
        drawRow({ label: 'Tổng khấu trừ', amount: slip.deductions, kind: 'total' });
      }

      // Thực lĩnh
      y += 14;
      ensureSpace(70);
      doc.roundedRect(left, y, width, 52, 8).fill(PDF_COLORS.ink);
      doc.font('bold').fontSize(10).fillColor(PDF_COLORS.white).text('THỰC LĨNH', left + 14, y + 12, { width: 150 });
      doc.font('bold').fontSize(18).fillColor(PDF_COLORS.white).text(money(slip.net), left + 150, y + 9, { width: width - 164, align: 'right' });
      const words = slip.net >= 0 ? moneyInWords(slip.net) : `Âm ${moneyInWords(-slip.net).toLowerCase()}`;
      doc.font('body').fontSize(8).fillColor('#D0D5DD').text(`Bằng chữ: ${words}`, left + 14, y + 33, { width: width - 28 });
      y += 64;

      if (slip.insuranceEmployer) {
        ensureSpace(24);
        doc.font('body').fontSize(8).fillColor(PDF_COLORS.muted)
          .text(`Xưởng đóng thêm bảo hiểm 21,5% = ${money(slip.insuranceEmployer)} (chi phí của xưởng, không trừ vào lương).`, left, y, { width });
        y = doc.y + 10;
      }

      // Ký nhận
      ensureSpace(84);
      y += 4;
      const half = width / 2;
      doc.font('bold').fontSize(9.5).fillColor(PDF_COLORS.ink)
        .text('NGƯỜI LẬP PHIẾU', left, y, { width: half, align: 'center' })
        .text('NGƯỜI NHẬN LƯƠNG', left + half, y, { width: half, align: 'center' });
      doc.font('body').fontSize(8).fillColor(PDF_COLORS.muted)
        .text('(Ký, ghi rõ họ tên)', left, y + 14, { width: half, align: 'center' })
        .text('(Ký, ghi rõ họ tên)', left + half, y + 14, { width: half, align: 'center' });
      doc.font('body').fontSize(9).fillColor(PDF_COLORS.text).text(data.worker.name, left + half, y + 64, { width: half, align: 'center' });

      addPdfPageFooters(doc, `PL-${year}${monthNumber}`, issuerName);
      doc.end();
    });
  }
}
