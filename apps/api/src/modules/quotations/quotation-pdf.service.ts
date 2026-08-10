import { Injectable } from '@nestjs/common';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import type { QuotationRecord } from '@eurohouse/types';
import axios from 'axios';

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');

function currency(value: number): string {
  return `${value.toLocaleString('vi-VN')} đ`;
}

@Injectable()
export class QuotationPdfService {
  async render(quotation: QuotationRecord, profile?: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      // Landscape A4
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
      doc.registerFont('body', join(FONT_DIR, 'NotoSans-Regular.ttf'));
      doc.registerFont('bold', join(FONT_DIR, 'NotoSans-Bold.ttf'));

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const brandColor = '#1e3a8a'; // Navy blue
      const textColor = '#1f2937';
      const textMuted = '#4b5563';

      let logoBuffer = null;
      if (profile?.logoUrl) {
        try {
          const logoStr: string = profile.logoUrl;
          if (logoStr.startsWith('http://') || logoStr.startsWith('https://')) {
            const res = await axios.get(logoStr, { responseType: 'arraybuffer' });
            logoBuffer = res.data;
          } else {
            const fs = await import('fs');
            const cleanPath = logoStr.replace(/^\/static\//, 'public/').replace(/^\//, '');
            const diskPath = join(process.cwd(), cleanPath);
            if (fs.existsSync(diskPath)) {
              logoBuffer = fs.readFileSync(diskPath);
            } else {
              const altPath = join(process.cwd(), 'public', 'images', 'logos', logoStr.split('/').pop() || '');
              if (fs.existsSync(altPath)) {
                logoBuffer = fs.readFileSync(altPath);
              }
            }
          }
        } catch (e) {
          // ignore logo errors
        }
      }

      // --- HEADER ---
      let startX = 30;
      if (logoBuffer) {
        doc.image(logoBuffer, 30, 30, { fit: [70, 70] });
        startX = 110;
      }

      const prodName = profile?.productionName || profile?.name || 'CƠ SỞ SẢN XUẤT NHÔM KÍNH';
      const address = profile?.address || '';
      const phone = profile?.phone || '';

      doc.font('bold').fontSize(16).fillColor(brandColor).text(prodName.toUpperCase(), startX, 30);
      
      let currentY = doc.y + 4;
      doc.font('body').fontSize(9.5).fillColor(textColor);
      if (profile?.mainCategories) {
        doc.text(`Thi công: ${profile.mainCategories}`, startX, currentY);
        currentY = doc.y + 2;
      }
      if (address) {
        doc.text(`Địa chỉ: ${address}`, startX, currentY);
        currentY = doc.y + 2;
      }
      if (phone) {
        doc.text(`Điện thoại: ${phone}`, startX, currentY);
        currentY = doc.y + 2;
      }
      if (profile?.email) {
        doc.text(`Email: ${profile.email}`, startX, currentY);
        currentY = doc.y + 2;
      }
      if (profile?.fanpage) {
        doc.text(`Fanpage: ${profile.fanpage}`, startX, currentY);
      }

      // Right side big title
      const isFinal = (quotation as any).isFinalSettlement;
      const pdfTitle = isFinal ? 'BẢNG QUYẾT TOÁN' : 'BẢNG DỰ TOÁN';
      const pdfIntro = isFinal 
        ? 'Chúng tôi xin gửi đến quý khách bảng quyết toán chi tiết các hạng mục như sau:' 
        : 'Chúng tôi xin gửi đến quý khách bảng dự toán chi tiết các hạng mục như sau:';

      doc.font('bold').fontSize(24).fillColor(brandColor)
         .text(pdfTitle, 30, 35, { align: 'right', width: doc.page.width - 60 });
      doc.font('body').fontSize(10).fillColor(textMuted)
         .text(`Ngày: ${new Date(quotation.createdAt).toLocaleDateString('vi-VN')}`, 30, 68, { align: 'right', width: doc.page.width - 60 });
      doc.text(`Mã số: ${quotation.code}`, 30, 83, { align: 'right', width: doc.page.width - 60 });

      doc.moveDown(2);
      
      doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).lineWidth(1.5).stroke(brandColor);
      doc.moveDown(0.8);

      // --- CUSTOMER INFO ---
      let customerTitle = `Kính gửi: Quý khách ${quotation.customerName || ''}`;
      if (quotation.customerPhone) {
        customerTitle += ` - ${quotation.customerPhone}`;
      }
      doc.font('bold').fontSize(11.5).fillColor(textColor).text(customerTitle);
      if (quotation.customerAddress) {
        doc.font('body').fontSize(10).text(`Địa chỉ công trình: ${quotation.customerAddress}`);
      }
      doc.font('body').fontSize(10).fillColor(textColor).text(pdfIntro);
      doc.moveDown(0.8);

      // --- TABLE ---
      // Landscape A4 printable width = 841.89 - 60 = 781.89
      const tableTop = doc.y;
      const colWidths = [35, 90, 230, 60, 60, 65, 40, 90, 110]; // sum = 780
      const colX = [30];
      for (let i = 0; i < colWidths.length; i++) {
        colX.push(colX[i] + colWidths[i]);
      }
      
      const drawCell = (x: number, y: number, w: number, h: number, text: string, align: 'left'|'center'|'right' = 'center', bold = false, textColorStr = textColor) => {
        doc.rect(x, y, w, h).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        doc.font(bold ? 'bold' : 'body').fontSize(8.5).fillColor(textColorStr);
        const textH = doc.heightOfString(text, { width: w - 6 });
        const startY = y + (h - textH) / 2;
        doc.text(text, x + 3, startY, { width: w - 6, align });
      };

      // Table Header
      const headerH = 24;
      doc.rect(colX[0], tableTop, colX[colX.length-1]-colX[0], headerH).fillAndStroke(brandColor, brandColor);
      
      const headers = ['STT', 'Tên cửa', 'Loại cửa - Quy cách', 'Rộng (mm)', 'Cao (mm)', 'DT/bộ (m2)', 'SL', 'Đơn giá', 'Thành tiền'];
      headers.forEach((text, i) => {
        doc.font('bold').fontSize(8.5).fillColor('#ffffff')
           .text(text, colX[i], tableTop + 7, { width: colWidths[i], align: 'center' });
        doc.moveTo(colX[i], tableTop).lineTo(colX[i], tableTop + headerH).strokeColor('#3b82f6').lineWidth(0.5).stroke();
      });
      doc.moveTo(colX[colX.length-1], tableTop).lineTo(colX[colX.length-1], tableTop + headerH).stroke();

      let rowY = tableTop + headerH;
      
      // Items
      quotation.items.forEach((it, idx) => {
        let quyCach = it.doorType;
        if (it.system) quyCach += `\n- Hệ: ${it.system.replace(/^Hệ\s+/i, '')}`;
        if (it.color) quyCach += `\n- Màu: ${it.color.replace(/^Màu\s+/i, '')}`;
        if (it.glassType) quyCach += `\n- Kính: ${it.glassType.replace(/^Kính\s+/i, '')}`;
        if (it.wallHugging && it.wallHugging !== 'Non') quyCach += `\n- Ôm tường: ${it.wallHugging}`;
        const dyn = (it.dynamicInputs as any) || {};
        if (dyn.chanSongSystem && dyn.chanSongSystem !== 'Không') {
          let csStr = dyn.chanSongSystem.replace(/^Hệ\s+/i, '');
          if (dyn.chanSongType) csStr += ` (${dyn.chanSongType})`;
          quyCach += `\n- Chấn song: ${csStr}`;
        }

        doc.font('body').fontSize(8.5);
        const textH = doc.heightOfString(quyCach, { width: colWidths[2] - 6 });
        const h = Math.max(textH + 12, 26);

        if (rowY + h > doc.page.height - 30) {
          doc.addPage();
          rowY = 30;
        }

        drawCell(colX[0], rowY, colWidths[0], h, `${idx + 1}`);
        drawCell(colX[1], rowY, colWidths[1], h, it.name);
        drawCell(colX[2], rowY, colWidths[2], h, quyCach, 'left');
        drawCell(colX[3], rowY, colWidths[3], h, `${it.widthMm}`);
        drawCell(colX[4], rowY, colWidths[4], h, `${it.heightMm}`);
        drawCell(colX[5], rowY, colWidths[5], h, `${it.areaM2}`);
        drawCell(colX[6], rowY, colWidths[6], h, `${it.quantity}`);
        drawCell(colX[7], rowY, colWidths[7], h, currency(it.pricePerM2 || 0), 'right');
        drawCell(colX[8], rowY, colWidths[8], h, currency(it.totalPrice || 0), 'right', true);
        
        rowY += h;
      });

      // Extra Products / Accessories (Phào đỉnh, Phụ kiện & Sản phẩm gia tăng)
      const extraList: any[] = quotation.extraProducts || [];
      
      // Fallback: Check if there are legacy phaoDinh in items not in extraList
      quotation.items.forEach(it => {
        const dyn = it.dynamicInputs as any;
        if (dyn && dyn.phaoDinhName && dyn.phaoDinhName !== 'Không') {
          const name = dyn.phaoDinhName;
          if (!extraList.some(e => e.name === name)) {
            extraList.push({
              name,
              description: name,
              unit: 'md',
              quantity: Number(dyn.phaoDinhLength) || 0,
              unitPrice: Number(dyn.phaoDinhPrice) || 0,
              totalPrice: Number(dyn.phaoDinhAmount) || (Number(dyn.phaoDinhLength) || 0) * (Number(dyn.phaoDinhPrice) || 0),
            });
          }
        }
      });

      if (extraList.length > 0) {
        // Draw Phụ kiện header
        const headerH = 22;
        if (rowY + headerH > doc.page.height - 30) {
          doc.addPage();
          rowY = 30;
        }
        doc.rect(colX[0], rowY, colX[colX.length-1]-colX[0], headerH).fillAndStroke('#e5e7eb', '#cbd5e1');
        doc.font('bold').fontSize(9).fillColor(textColor)
           .text('SẢN PHẨM GIA TĂNG & PHỤ KIỆN', colX[0], rowY + 6, { width: colX[colX.length-1]-colX[0], align: 'center' });
        rowY += headerH;

        extraList.forEach((ep, idx) => {
          const descStr = ep.description && ep.description.trim() ? ep.description.trim() : ep.name;
          doc.font('body').fontSize(8.5);
          const descTextH = doc.heightOfString(descStr, { width: colWidths[2] - 6 });
          const rowH = Math.max(descTextH + 10, 22);

          if (rowY + rowH > doc.page.height - 30) {
            doc.addPage();
            rowY = 30;
          }
          const unitStr = ep.unit || 'md';
          const qtyStr = `${ep.quantity} ${unitStr}`;
          
          drawCell(colX[0], rowY, colWidths[0], rowH, `${idx + 1}`);
          drawCell(colX[1], rowY, colWidths[1], rowH, ep.name, 'left', true);
          drawCell(colX[2], rowY, colWidths[2], rowH, descStr, 'left');
          drawCell(colX[3], rowY, colWidths[3], rowH, '');
          drawCell(colX[4], rowY, colWidths[4], rowH, '');
          drawCell(colX[5], rowY, colWidths[5], rowH, qtyStr, 'center');
          drawCell(colX[6], rowY, colWidths[6], rowH, '');
          drawCell(colX[7], rowY, colWidths[7], rowH, currency(ep.unitPrice || 0), 'right');
          drawCell(colX[8], rowY, colWidths[8], rowH, currency(ep.totalPrice || (ep.quantity * ep.unitPrice)), 'right', true, '#dc2626');
          rowY += rowH;
        });
      }

      // Total Row(s)
      const vatPct = quotation.vatPct || 0;
      const vatAmount = quotation.vatAmount || 0;
      const subtotalBeforeVat = quotation.totalAmount - vatAmount;

      if (vatPct > 0 && vatAmount > 0) {
        const totalH = 22;
        // Row 1: Subtotal before VAT
        doc.rect(colX[0], rowY, colX[colX.length-1]-colX[0], totalH).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.font('bold').fontSize(9.5).fillColor(textColor)
           .text('TỔNG CỘNG TIỀN HÀNG (CHƯA VAT)', colX[0], rowY + 6, { width: colX[colX.length-1]-colX[0] - colWidths[8] - 10, align: 'right' });
        drawCell(colX[8], rowY, colWidths[8], totalH, currency(subtotalBeforeVat), 'right', true, textColor);
        rowY += totalH;

        // Row 2: VAT Amount
        doc.rect(colX[0], rowY, colX[colX.length-1]-colX[0], totalH).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.font('bold').fontSize(9.5).fillColor(textColor)
           .text(`THUẾ VAT (${vatPct}%)`, colX[0], rowY + 6, { width: colX[colX.length-1]-colX[0] - colWidths[8] - 10, align: 'right' });
        drawCell(colX[8], rowY, colWidths[8], totalH, currency(vatAmount), 'right', true, textColor);
        rowY += totalH;

        // Row 3: Final Total
        const totalLabel = isFinal ? 'TỔNG CỘNG GIÁ TRỊ QUYẾT TOÁN' : 'TỔNG CỘNG THANH TOÁN';
        doc.rect(colX[0], rowY, colX[colX.length-1]-colX[0], 24).fillAndStroke('#f3f4f6', '#cbd5e1');
        doc.font('bold').fontSize(10).fillColor(brandColor)
           .text(totalLabel, colX[0], rowY + 7, { width: colX[colX.length-1]-colX[0] - colWidths[8] - 10, align: 'right' });
        drawCell(colX[8], rowY, colWidths[8], 24, currency(quotation.totalAmount), 'right', true, '#dc2626');
        rowY += 24;

        if (isFinal && (quotation as any).depositAmount > 0) {
          const deposit = (quotation as any).depositAmount || 0;
          const remaining = Math.max(0, quotation.totalAmount - deposit);

          // Row 4: Deposit
          doc.rect(colX[0], rowY, colX[colX.length-1]-colX[0], 22).fillAndStroke('#fff8f0', '#cbd5e1');
          doc.font('bold').fontSize(9.5).fillColor(textColor)
             .text('ĐÃ TẠM ỨNG (ĐỢT 1 / ĐẶT CỌC)', colX[0], rowY + 6, { width: colX[colX.length-1]-colX[0] - colWidths[8] - 10, align: 'right' });
          drawCell(colX[8], rowY, colWidths[8], 22, `-${currency(deposit)}`, 'right', true, '#ea580c');
          rowY += 22;

          // Row 5: Remaining
          doc.rect(colX[0], rowY, colX[colX.length-1]-colX[0], 26).fillAndStroke('#fef2f2', '#cbd5e1');
          doc.font('bold').fontSize(10).fillColor('#b91c1c')
             .text('SỐ TIỀN CÒN LẠI PHẢI THANH TOÁN', colX[0], rowY + 8, { width: colX[colX.length-1]-colX[0] - colWidths[8] - 10, align: 'right' });
          drawCell(colX[8], rowY, colWidths[8], 26, currency(remaining), 'right', true, '#b91c1c');
          rowY += 26;
        }
      } else {
        const totalH = 26;
        const totalLabel = isFinal ? 'TỔNG CỘNG GIÁ TRỊ QUYẾT TOÁN' : 'TỔNG CỘNG THANH TOÁN';
        doc.rect(colX[0], rowY, colX[colX.length-1]-colX[0], totalH).fillAndStroke('#f3f4f6', '#cbd5e1');
        doc.font('bold').fontSize(10).fillColor(brandColor)
           .text(totalLabel, colX[0], rowY + 8, { width: colX[colX.length-1]-colX[0] - colWidths[8] - 10, align: 'right' });
        drawCell(colX[8], rowY, colWidths[8], totalH, currency(quotation.totalAmount), 'right', true, '#dc2626');
        rowY += totalH;

        if (isFinal && (quotation as any).depositAmount > 0) {
          const deposit = (quotation as any).depositAmount || 0;
          const remaining = Math.max(0, quotation.totalAmount - deposit);

          // Row: Deposit
          doc.rect(colX[0], rowY, colX[colX.length-1]-colX[0], 22).fillAndStroke('#fff8f0', '#cbd5e1');
          doc.font('bold').fontSize(9.5).fillColor(textColor)
             .text('ĐÃ TẠM ỨNG (ĐỢT 1 / ĐẶT CỌC)', colX[0], rowY + 6, { width: colX[colX.length-1]-colX[0] - colWidths[8] - 10, align: 'right' });
          drawCell(colX[8], rowY, colWidths[8], 22, `-${currency(deposit)}`, 'right', true, '#ea580c');
          rowY += 22;

          // Row: Remaining
          doc.rect(colX[0], rowY, colX[colX.length-1]-colX[0], 26).fillAndStroke('#fef2f2', '#cbd5e1');
          doc.font('bold').fontSize(10).fillColor('#b91c1c')
             .text('SỐ TIỀN CÒN LẠI PHẢI THANH TOÁN', colX[0], rowY + 8, { width: colX[colX.length-1]-colX[0] - colWidths[8] - 10, align: 'right' });
          drawCell(colX[8], rowY, colWidths[8], 26, currency(remaining), 'right', true, '#b91c1c');
          rowY += 26;
        }
      }

      // Footer Notes (Left aligned, wide format matching table width)
      const noteY = rowY + 12;
      if (noteY + 70 > doc.page.height - 30) {
        doc.addPage();
        doc.y = 30;
      } else {
        doc.y = noteY;
      }

      const hasVat = (quotation.vatPct && quotation.vatPct > 0) || (quotation.vatAmount && quotation.vatAmount > 0);
      const vatNote = hasVat
        ? `- Báo giá/Dự toán đã bao gồm thuế VAT (${quotation.vatPct || 0}%).`
        : '- Báo giá/Dự toán chưa bao gồm thuế VAT (nếu có).';

      doc.font('bold').fontSize(9.5).fillColor(textColor).text('GHI CHÚ:', 30, doc.y, { width: 780, align: 'left' });
      doc.moveDown(0.3);
      doc.font('body').fontSize(9).fillColor(textColor)
         .text(vatNote, { width: 780, align: 'left' })
         .text('- Báo giá có giá trị trong vòng 15 ngày kể từ ngày báo giá.', { width: 780, align: 'left' })
         .text('- Công trình được bảo hành 12 tháng - Riêng phần Thanh nhôm bảo hành theo tiêu chuẩn của nhà sản xuất từ 10-15 năm màu sơn.', { width: 780, align: 'left' })
         .text('- Phụ kiện bảo hành theo tiêu chuẩn nhà sản xuất.', { width: 780, align: 'left' });

      if (quotation.notes) {
        doc.moveDown(0.5);
        doc.font('bold').fontSize(9.5).text('Ghi chú thêm:');
        doc.font('body').fontSize(9).text(quotation.notes, { width: 780, align: 'left' });
      }

      doc.moveDown(1.5);
      const footerY = Math.max(doc.y, doc.page.height - 60);
      doc.font('bold').fontSize(10).text('ĐẠI DIỆN KHÁCH HÀNG', 30, footerY, { width: 220, align: 'center' });
      doc.font('bold').fontSize(10).text('ĐẠI DIỆN ĐƠN VỊ THI CÔNG', doc.page.width - 250, footerY, { width: 220, align: 'center' });

      doc.end();
    });
  }
}
 
