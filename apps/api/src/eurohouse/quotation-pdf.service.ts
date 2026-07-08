import { Injectable } from '@nestjs/common';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import type { QuotationRecord } from '@eurohouse/types';

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');

function currency(value: number): string {
  return `${value.toLocaleString('vi-VN')} đ`;
}

@Injectable()
export class QuotationPdfService {
  render(quotation: QuotationRecord): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      doc.registerFont('body', join(FONT_DIR, 'NotoSans-Regular.ttf'));
      doc.registerFont('bold', join(FONT_DIR, 'NotoSans-Bold.ttf'));

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('bold').fontSize(20).text('BÁO GIÁ NHÔM KÍNH EUROHOUSE', { align: 'center' });
      doc.moveDown(0.5);
      doc.font('body').fontSize(11).fillColor('#555').text(`Mã báo giá: ${quotation.code}`, { align: 'center' });
      doc.text(`Ngày tạo: ${new Date(quotation.createdAt).toLocaleDateString('vi-VN')}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1.5);

      doc.font('bold').fontSize(13).text('Thông tin khách hàng');
      doc.moveDown(0.3);
      doc.font('body').fontSize(11);
      doc.text(`Khách hàng: ${quotation.customerName || '—'}`);
      doc.text(`Loại cửa: ${quotation.doorType || '—'}`);
      doc.text(`Kích thước: ${quotation.widthMm} × ${quotation.heightMm} mm — Số lượng: ${quotation.quantity} bộ`);
      doc.moveDown(1.2);

      doc.font('bold').fontSize(13).text('Chi tiết báo giá');
      doc.moveDown(0.4);

      const rows: [string, string][] = [
        [`Diện tích (${quotation.areaM2} m²)`, currency(quotation.baseAmount)],
        ['Phụ kiện', currency(quotation.accessoryCost)],
        ['Nhân công sản xuất', currency(quotation.laborCost)],
        ['Chi phí lắp đặt', currency(quotation.installCost)],
        ['Khấu hao khác', currency(quotation.depreciation)],
        [`Lợi nhuận (${quotation.profitPct}%)`, currency(quotation.profitAmount)],
      ];

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      doc.font('body').fontSize(11);
      for (const [label, value] of rows) {
        const y = doc.y;
        doc.text(label, left, y);
        doc.text(value, left, y, { width: right - left, align: 'right' });
        doc.moveDown(0.6);
      }

      doc.moveDown(0.3);
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#DDD').stroke();
      doc.moveDown(0.6);

      doc.font('bold').fontSize(14);
      const totalY = doc.y;
      doc.text('TỔNG BÁO GIÁ', left, totalY);
      doc.text(currency(quotation.totalAmount), left, totalY, { width: right - left, align: 'right' });

      doc.moveDown(3);
      doc.font('body').fontSize(9).fillColor('#888').text(
        'Báo giá có giá trị tham khảo, có thể thay đổi theo thời điểm ký hợp đồng.',
        { align: 'center' },
      );

      doc.end();
    });
  }
}
