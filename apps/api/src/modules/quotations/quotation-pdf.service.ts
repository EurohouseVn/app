import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { QuotationRecord } from '@eurohouse/types';
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

export type QuotationPdfKind = 'quotation' | 'estimate';

interface TableRow {
  sequence: string;
  name: string;
  description: string;
  width: string;
  height: string;
  area: string;
  quantity: string;
  unitPrice: number;
  amount: number;
  accent?: boolean;
}

const PAGE_MARGIN = 24;
const FOOTER_RESERVE = 42;

function cleanLabel(value: string | undefined, prefix: RegExp): string {
  return (value || '').replace(prefix, '').trim();
}

@Injectable()
export class QuotationPdfService {
  async render(
    quotation: QuotationRecord,
    profile?: PdfIssuerProfile | null,
    kind: QuotationPdfKind = 'quotation',
  ): Promise<Buffer> {
    const logo = await loadPdfLogo(profile || undefined);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: PAGE_MARGIN,
        bufferPages: true,
        info: {
          Title: `${kind === 'estimate' ? 'Bảng dự toán' : 'Báo giá'} ${quotation.code}`,
          Author: profile?.productionName || profile?.name || 'EUROHOUSE Workshop OS',
          Subject: `Hồ sơ ${quotation.code} - ${quotation.customerName || 'Khách hàng'}`,
          Creator: 'EUROHOUSE Workshop OS',
        },
      });
      registerPdfFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const left = PAGE_MARGIN;
      const contentWidth = doc.page.width - PAGE_MARGIN * 2;
      const right = left + contentWidth;
      const bottom = () => doc.page.height - FOOTER_RESERVE;
      const issuerName = profile?.productionName || profile?.name || 'CƠ SỞ SẢN XUẤT NHÔM KÍNH';
      const isFinal = Boolean(quotation.isFinalSettlement);
      const title = isFinal ? 'BẢNG QUYẾT TOÁN' : kind === 'estimate' ? 'BẢNG DỰ TOÁN' : 'BÁO GIÁ';

      const drawDocumentHeader = (continuation = false) => {
        const top = PAGE_MARGIN;
        if (continuation) {
          doc.font('bold').fontSize(10).fillColor(PDF_COLORS.ink).text(issuerName, left, top, { width: contentWidth * 0.62 });
          doc.font('bold').fontSize(10).fillColor(PDF_COLORS.orange)
            .text(`${title} - ${quotation.code} (tiếp theo)`, left, top, { width: contentWidth, align: 'right' });
          doc.moveTo(left, top + 20).lineTo(right, top + 20).lineWidth(1).strokeColor(PDF_COLORS.orange).stroke();
          return top + 30;
        }

        doc.rect(left, top, 5, 76).fill(PDF_COLORS.orange);
        let companyX = left + 16;
        if (logo) {
          try {
            doc.image(logo, companyX, top + 4, { fit: [58, 58], align: 'center', valign: 'center' });
            companyX += 70;
          } catch {
            // The document remains usable when a customer logo has an unsupported format.
          }
        }
        const companyWidth = contentWidth * 0.59 - (companyX - left);
        doc.font('bold').fontSize(15).fillColor(PDF_COLORS.ink).text(issuerName.toUpperCase(), companyX, top + 3, { width: companyWidth });
        let infoY = top + 27;
        const issuerLines = [
          profile?.mainCategories ? `Lĩnh vực: ${profile.mainCategories}` : '',
          profile?.address ? `Địa chỉ: ${profile.address}` : '',
          [profile?.phone, profile?.email, profile?.fanpage].filter(Boolean).join(' | '),
        ].filter(Boolean);
        doc.font('body').fontSize(8.3).fillColor(PDF_COLORS.muted);
        issuerLines.slice(0, 3).forEach((line) => {
          doc.text(line, companyX, infoY, { width: companyWidth, lineBreak: false, ellipsis: true });
          infoY += 12;
        });

        const metaX = left + contentWidth * 0.63;
        const metaWidth = right - metaX;
        doc.font('bold').fontSize(22).fillColor(PDF_COLORS.orange).text(title, metaX, top + 2, { width: metaWidth, align: 'right' });
        doc.font('body').fontSize(8.8).fillColor(PDF_COLORS.text)
          .text(`Số: ${quotation.code}`, metaX, top + 35, { width: metaWidth, align: 'right' })
          .text(`Ngày lập: ${formatPdfDate(quotation.createdAt)}`, metaX, top + 49, { width: metaWidth, align: 'right' });
        doc.moveTo(left, top + 82).lineTo(right, top + 82).lineWidth(1.3).strokeColor(PDF_COLORS.orange).stroke();
        return top + 92;
      };

      let cursorY = drawDocumentHeader();
      const customerHeight = quotation.customerAddress ? 62 : 50;
      doc.roundedRect(left, cursorY, contentWidth, customerHeight, 5).fillAndStroke(PDF_COLORS.soft, PDF_COLORS.line);
      doc.font('bold').fontSize(9.5).fillColor(PDF_COLORS.ink)
        .text(`Kính gửi: ${quotation.customerName || 'Quý khách hàng'}`, left + 12, cursorY + 9, { width: contentWidth * 0.54 });
      doc.font('body').fontSize(8.7).fillColor(PDF_COLORS.text)
        .text(`Điện thoại: ${quotation.customerPhone || '-'}`, left + 12, cursorY + 27, { width: contentWidth * 0.45 });
      if (quotation.customerAddress) {
        doc.text(`Địa chỉ công trình: ${quotation.customerAddress}`, left + 12, cursorY + 42, { width: contentWidth * 0.62, lineBreak: false, ellipsis: true });
      }
      const intro = isFinal
        ? 'Kính gửi Quý khách bảng quyết toán các hạng mục đã thực hiện.'
        : kind === 'estimate'
          ? 'Kính gửi Quý khách bảng dự toán chi tiết làm cơ sở thống nhất phạm vi thi công.'
          : 'Trân trọng gửi Quý khách báo giá các hạng mục nhôm kính theo thông tin dưới đây.';
      doc.font('body').fontSize(8.5).fillColor(PDF_COLORS.muted)
        .text(intro, left + contentWidth * 0.62, cursorY + 12, { width: contentWidth * 0.35, align: 'right' });
      cursorY += customerHeight + 10;

      const widths = [32, 82, 236, 62, 62, 64, 38, 88, 126];
      const xs = [left];
      widths.forEach((width) => xs.push(xs[xs.length - 1] + width));
      const headers = ['STT', 'Ký hiệu', 'Hạng mục - Quy cách', 'Rộng\n(mm)', 'Cao\n(mm)', 'DT/bộ\n(m²)', 'SL', 'Đơn giá', 'Thành tiền'];

      const drawTableHeader = (y: number) => {
        const height = 28;
        doc.rect(left, y, contentWidth, height).fill(PDF_COLORS.ink);
        headers.forEach((header, index) => {
          doc.font('bold').fontSize(7.7).fillColor(PDF_COLORS.white)
            .text(header, xs[index] + 3, y + 6, { width: widths[index] - 6, height: height - 7, align: 'center' });
          if (index > 0) doc.moveTo(xs[index], y).lineTo(xs[index], y + height).lineWidth(0.35).strokeColor('#667085').stroke();
        });
        return y + height;
      };

      const drawCell = (x: number, y: number, width: number, height: number, text: string, align: 'left' | 'center' | 'right', bold = false, color = PDF_COLORS.text) => {
        doc.rect(x, y, width, height).lineWidth(0.45).strokeColor(PDF_COLORS.line).stroke();
        doc.font(bold ? 'bold' : 'body').fontSize(8).fillColor(color);
        const textHeight = doc.heightOfString(text, { width: width - 7, align });
        doc.text(text, x + 3.5, y + Math.max(4, (height - textHeight) / 2), { width: width - 7, height: height - 5, align, ellipsis: true });
      };

      const descriptionFor = (item: QuotationRecord['items'][number]) => {
        const details = [item.doorType];
        if (item.system) details.push(`Hệ: ${cleanLabel(item.system, /^Hệ\s+/i)}`);
        if (item.color) details.push(`Màu: ${cleanLabel(item.color, /^Màu\s+/i)}`);
        if (item.glassType) details.push(`Kính: ${cleanLabel(item.glassType, /^Kính\s+/i)}`);
        if (item.glassColor) details.push(`Màu kính: ${item.glassColor}`);
        if (item.wallHugging && item.wallHugging !== 'Non') details.push(`Ôm tường: ${item.wallHugging}`);
        const dynamic = item.dynamicInputs || {};
        if (dynamic.chanSongSystem && dynamic.chanSongSystem !== 'Không') {
          details.push(`Chấn song: ${dynamic.chanSongSystem}${dynamic.chanSongType ? ` - ${dynamic.chanSongType}` : ''}`);
        }
        return details.filter(Boolean).join('\n');
      };

      const rows: TableRow[] = quotation.items.map((item, index) => ({
        sequence: String(index + 1),
        name: item.name || `HM${index + 1}`,
        description: descriptionFor(item),
        width: formatDecimal(item.widthMm, 0),
        height: formatDecimal(item.heightMm, 0),
        area: formatDecimal(item.areaM2, 2),
        quantity: formatDecimal(item.quantity, 0),
        unitPrice: item.pricePerM2 || 0,
        amount: item.totalPrice || 0,
      }));

      const extraProducts = [...(quotation.extraProducts || [])];
      quotation.items.forEach((item) => {
        const dynamic = item.dynamicInputs || {};
        const name = dynamic.phaoDinhName;
        if (name && name !== 'Không' && !extraProducts.some((extra) => extra.name === name)) {
          const quantity = Number(dynamic.phaoDinhLength) || 0;
          const unitPrice = Number(dynamic.phaoDinhPrice) || 0;
          extraProducts.push({
            name,
            description: name,
            unit: 'md',
            quantity,
            unitPrice,
            totalPrice: Number(dynamic.phaoDinhAmount) || quantity * unitPrice,
          });
        }
      });
      extraProducts.forEach((item, index) => rows.push({
        sequence: `PK${index + 1}`,
        name: item.name,
        description: item.description || item.name,
        width: '',
        height: '',
        area: `${formatDecimal(item.quantity, 2)} ${item.unit || ''}`.trim(),
        quantity: '',
        unitPrice: item.unitPrice || 0,
        amount: item.totalPrice || item.quantity * item.unitPrice,
        accent: true,
      }));

      cursorY = drawTableHeader(cursorY);
      rows.forEach((row) => {
        doc.font('body').fontSize(8);
        const rowHeight = Math.max(
          27,
          doc.heightOfString(row.name, { width: widths[1] - 7 }) + 10,
          doc.heightOfString(row.description, { width: widths[2] - 7 }) + 10,
        );
        if (cursorY + rowHeight > bottom()) {
          doc.addPage();
          cursorY = drawDocumentHeader(true);
          cursorY = drawTableHeader(cursorY);
        }
        if (row.accent) doc.rect(left, cursorY, contentWidth, rowHeight).fill(PDF_COLORS.orangeSoft);
        const cells = [row.sequence, row.name, row.description, row.width, row.height, row.area, row.quantity, formatMoney(row.unitPrice), formatMoney(row.amount)];
        const aligns: Array<'left' | 'center' | 'right'> = ['center', 'left', 'left', 'center', 'center', 'center', 'center', 'right', 'right'];
        cells.forEach((cell, index) => drawCell(xs[index], cursorY, widths[index], rowHeight, cell, aligns[index], index === 8, index === 8 ? PDF_COLORS.ink : PDF_COLORS.text));
        cursorY += rowHeight;
      });

      const vatAmount = quotation.vatAmount || 0;
      const vatPct = quotation.vatPct || 0;
      const amountBeforeVat = Math.max(0, quotation.totalAmount - vatAmount);
      const deposit = quotation.depositAmount || 0;
      const remainingAmount = Math.max(0, quotation.totalAmount - deposit);
      const totalRows = [
        ...(vatAmount > 0 ? [
          { label: 'TỔNG GIÁ TRỊ TRƯỚC THUẾ', value: amountBeforeVat, color: PDF_COLORS.text },
          { label: `THUẾ VAT (${formatDecimal(vatPct, 1)}%)`, value: vatAmount, color: PDF_COLORS.text },
        ] : []),
        { label: isFinal ? 'TỔNG GIÁ TRỊ QUYẾT TOÁN' : 'TỔNG CỘNG THANH TOÁN', value: quotation.totalAmount, color: PDF_COLORS.orange },
        ...(isFinal && deposit > 0 ? [
          { label: 'ĐÃ TẠM ỨNG / ĐẶT CỌC', value: -deposit, color: PDF_COLORS.text },
          { label: 'CÒN LẠI PHẢI THANH TOÁN', value: remainingAmount, color: PDF_COLORS.red },
        ] : []),
      ];
      const totalsHeight = totalRows.length * 24 + 35;
      if (cursorY + totalsHeight > bottom()) {
        doc.addPage();
        cursorY = drawDocumentHeader(true);
      }
      totalRows.forEach((row, index) => {
        const isGrandTotal = index === (vatAmount > 0 ? 2 : 0);
        doc.rect(left, cursorY, contentWidth, 24).fillAndStroke(isGrandTotal ? PDF_COLORS.orangeSoft : PDF_COLORS.soft, PDF_COLORS.line);
        doc.font('bold').fontSize(isGrandTotal ? 9.5 : 8.6).fillColor(row.color)
          .text(row.label, left + 8, cursorY + 6, { width: contentWidth - 152, align: 'right' });
        doc.text(formatMoney(row.value), right - 138, cursorY + 6, { width: 130, align: 'right' });
        cursorY += 24;
      });
      doc.font('bold').fontSize(8.5).fillColor(PDF_COLORS.ink)
        .text(`Bằng chữ: ${moneyInWords(isFinal && deposit > 0 ? remainingAmount : quotation.totalAmount)}.`, left + 8, cursorY + 8, { width: contentWidth - 16 });
      cursorY += 32;

      const noteLines = [
        vatAmount > 0 ? `Giá trị trên đã bao gồm VAT ${formatDecimal(vatPct, 1)}%.` : 'Giá trị trên chưa bao gồm VAT, trừ khi có thỏa thuận khác bằng văn bản.',
        'Báo giá có hiệu lực 15 ngày kể từ ngày lập.',
        'Tiến độ, phương thức thanh toán và phạm vi thi công được xác nhận trong hợp đồng hoặc biên bản thống nhất.',
        'Nhôm, kính và phụ kiện được bảo hành theo điều kiện của nhà sản xuất và đơn vị thi công.',
      ];
      if (cursorY + 138 > bottom()) {
        doc.addPage();
        cursorY = drawDocumentHeader(true);
      }
      doc.font('bold').fontSize(9.5).fillColor(PDF_COLORS.ink).text('ĐIỀU KHOẢN VÀ GHI CHÚ', left, cursorY);
      cursorY += 16;
      doc.font('body').fontSize(8.3).fillColor(PDF_COLORS.text);
      noteLines.forEach((line, index) => {
        doc.text(`${index + 1}. ${line}`, left, cursorY, { width: contentWidth });
        cursorY = doc.y + 3;
      });
      if (quotation.notes?.trim()) {
        doc.font('bold').text('Ghi chú riêng:', left, cursorY, { continued: true });
        doc.font('body').text(` ${quotation.notes.trim()}`, { width: contentWidth - 75 });
        cursorY = doc.y + 4;
      }

      const signatureY = Math.max(cursorY + 16, bottom() - 82);
      if (signatureY + 62 > bottom()) {
        doc.addPage();
        cursorY = drawDocumentHeader(true);
      } else {
        cursorY = signatureY;
      }
      const signatureWidth = 230;
      doc.font('bold').fontSize(9).fillColor(PDF_COLORS.ink)
        .text('ĐẠI DIỆN KHÁCH HÀNG', left + 36, cursorY, { width: signatureWidth, align: 'center' })
        .text('ĐẠI DIỆN ĐƠN VỊ THI CÔNG', right - signatureWidth - 36, cursorY, { width: signatureWidth, align: 'center' });
      doc.font('body').fontSize(7.5).fillColor(PDF_COLORS.muted)
        .text('(Ký, ghi rõ họ tên)', left + 36, cursorY + 15, { width: signatureWidth, align: 'center' })
        .text('(Ký, ghi rõ họ tên và đóng dấu)', right - signatureWidth - 36, cursorY + 15, { width: signatureWidth, align: 'center' });

      addPdfPageFooters(doc, quotation.code, issuerName);
      doc.end();
    });
  }
}
