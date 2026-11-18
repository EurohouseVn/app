import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  PDF_COLORS,
  addPdfPageFooters,
  formatDecimal,
  loadPdfLogo,
  registerPdfFonts,
  type PdfIssuerProfile,
} from '../../common/pdf-document.util';
import type { ManagedCuttingPlanResult } from './managed-cutting-plan.service';

const PAGE_MARGIN = 24;
const FOOTER_RESERVE = 42;

@Injectable()
export class CuttingPlanPdfService {
  async render(plan: ManagedCuttingPlanResult, profile?: PdfIssuerProfile | null): Promise<Buffer> {
    const logo = await loadPdfLogo(profile || undefined);
    return new Promise((resolve, reject) => {
      const issuerName = profile?.productionName || profile?.name || 'CƠ SỞ SẢN XUẤT NHÔM KÍNH';
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: PAGE_MARGIN,
        bufferPages: true,
        info: {
          Title: `Phiếu cắt nhôm ${plan.planRef}`,
          Author: issuerName,
          Subject: 'Sơ đồ cắt và bảng cân đối khối lượng nhôm',
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

      const drawHeader = (continuation = false) => {
        const top = PAGE_MARGIN;
        if (continuation) {
          doc.font('bold').fontSize(10).fillColor(PDF_COLORS.ink).text(issuerName, left, top, { width: contentWidth * 0.58 });
          doc.font('bold').fontSize(10).fillColor(PDF_COLORS.orange)
            .text(`PHIẾU CẮT NHÔM - ${plan.planRef} (tiếp theo)`, left, top, { width: contentWidth, align: 'right' });
          doc.moveTo(left, top + 20).lineTo(right, top + 20).lineWidth(1).strokeColor(PDF_COLORS.orange).stroke();
          return top + 30;
        }

        doc.rect(left, top, 5, 70).fill(PDF_COLORS.orange);
        let companyX = left + 16;
        if (logo) {
          try {
            doc.image(logo, companyX, top + 4, { fit: [54, 54], align: 'center', valign: 'center' });
            companyX += 66;
          } catch {
            // An unsupported custom logo must not prevent the cutting sheet from being printed.
          }
        }
        const companyWidth = contentWidth * 0.58 - (companyX - left);
        doc.font('bold').fontSize(14).fillColor(PDF_COLORS.ink).text(issuerName.toUpperCase(), companyX, top + 2, { width: companyWidth });
        const contactLines = [
          profile?.address ? `Địa chỉ: ${profile.address}` : '',
          [profile?.phone, profile?.email].filter(Boolean).join(' | '),
        ].filter(Boolean);
        doc.font('body').fontSize(8.3).fillColor(PDF_COLORS.muted);
        contactLines.forEach((line, index) => doc.text(line, companyX, top + 27 + index * 13, { width: companyWidth, lineBreak: false, ellipsis: true }));

        const metaX = left + contentWidth * 0.61;
        const metaWidth = right - metaX;
        doc.font('bold').fontSize(20).fillColor(PDF_COLORS.orange).text('PHIẾU CẮT NHÔM', metaX, top + 1, { width: metaWidth, align: 'right' });
        doc.font('body').fontSize(8.6).fillColor(PDF_COLORS.text)
          .text(`Số phiếu: ${plan.planRef}`, metaX, top + 34, { width: metaWidth, align: 'right' })
          .text(`Ngày lập: ${new Date(plan.generatedAt).toLocaleString('vi-VN')}`, metaX, top + 49, { width: metaWidth, align: 'right' });
        doc.moveTo(left, top + 76).lineTo(right, top + 76).lineWidth(1.3).strokeColor(PDF_COLORS.orange).stroke();
        return top + 86;
      };

      const drawSectionTitle = (title: string, y: number) => {
        doc.rect(left, y, contentWidth, 22).fill(PDF_COLORS.ink);
        doc.font('bold').fontSize(9).fillColor(PDF_COLORS.white).text(title, left + 8, y + 6, { width: contentWidth - 16 });
        return y + 22;
      };

      const drawTableHeader = (headers: string[], widths: number[], y: number) => {
        let x = left;
        doc.rect(left, y, contentWidth, 26).fill(PDF_COLORS.ink);
        headers.forEach((header, index) => {
          doc.font('bold').fontSize(7.5).fillColor(PDF_COLORS.white)
            .text(header, x + 3, y + 6, { width: widths[index] - 6, height: 18, align: 'center' });
          if (index > 0) doc.moveTo(x, y).lineTo(x, y + 26).lineWidth(0.35).strokeColor('#667085').stroke();
          x += widths[index];
        });
        return y + 26;
      };

      const drawRow = (cells: string[], widths: number[], y: number, height: number, aligns: Array<'left' | 'center' | 'right'> = []) => {
        let x = left;
        cells.forEach((cell, index) => {
          doc.rect(x, y, widths[index], height).lineWidth(0.4).strokeColor(PDF_COLORS.line).stroke();
          doc.font(index === 1 ? 'bold' : 'body').fontSize(7.6).fillColor(PDF_COLORS.text);
          const align = aligns[index] || 'left';
          const textHeight = doc.heightOfString(cell, { width: widths[index] - 7, align });
          doc.text(cell, x + 3.5, y + Math.max(4, (height - textHeight) / 2), {
            width: widths[index] - 7,
            height: height - 5,
            align,
            ellipsis: true,
          });
          x += widths[index];
        });
        return y + height;
      };

      let cursorY = drawHeader();
      const summaryItems = [
        ['TỔNG KG NHÔM CẦN', plan.summary.totalInputKg],
        ['KG NHÔM THÀNH PHẨM', plan.summary.finishedKg],
        ['DC CÒN LẠI', plan.summary.reusableRemnantKg],
        ['DC VỤN', plan.summary.scrapKg],
      ] as const;
      const cardGap = 8;
      const cardWidth = (contentWidth - cardGap * 3) / 4;
      summaryItems.forEach(([label, value], index) => {
        const x = left + index * (cardWidth + cardGap);
        doc.roundedRect(x, cursorY, cardWidth, 48, 4).fillAndStroke(index === 0 ? PDF_COLORS.orangeSoft : PDF_COLORS.soft, PDF_COLORS.line);
        doc.font('bold').fontSize(7.5).fillColor(PDF_COLORS.muted).text(label, x + 8, cursorY + 8, { width: cardWidth - 16 });
        doc.font('bold').fontSize(15).fillColor(index === 0 ? PDF_COLORS.orange : PDF_COLORS.ink)
          .text(`${formatDecimal(value, 3)} kg`, x + 8, cursorY + 23, { width: cardWidth - 16 });
      });
      cursorY += 57;
      doc.font('body').fontSize(7.7).fillColor(PDF_COLORS.muted)
        .text(`Vật tư đầu vào gồm ${plan.summary.newBars} cây mới (${formatDecimal(plan.summary.newStockKg, 3)} kg) và ${plan.summary.reusedDeXePieces} DC tận dụng (${formatDecimal(plan.summary.reusedDeXeKg, 3)} kg). DC dài từ 1.000 mm được giữ lại kho. Mạch cắt mặc định 5 mm.`, left, cursorY, { width: contentWidth });
      cursorY += 18;

      cursorY = drawSectionTitle('DANH SÁCH ĐOẠN CẮT', cursorY);
      const cutWidths = [30, 70, 150, 70, 45, 75, 145, 208];
      const cutHeaders = ['STT', 'MÃ THANH', 'TÊN THANH', 'DÀI (MM)', 'SL', 'GÓC CẮT', 'BỘ CỬA', 'GHI CHÚ'];
      cursorY = drawTableHeader(cutHeaders, cutWidths, cursorY);
      const cutRows = new Map<string, { code: string; name: string; length: number; quantity: number; angle: string; door: string }>();
      plan.materials.forEach((material) => material.barLayouts?.forEach((layout) => layout.cuts.forEach((cut) => {
        const key = [material.materialCode, cut.lengthMm, cut.cutAngle, cut.doorName].join('|');
        const current = cutRows.get(key) ?? {
          code: material.materialCode,
          name: cut.profileName || material.materialName || material.materialCode,
          length: cut.lengthMm,
          quantity: 0,
          angle: cut.cutAngle || '90-90',
          door: cut.doorName || '-',
        };
        current.quantity += 1;
        cutRows.set(key, current);
      })));
      let cutIndex = 0;
      for (const row of cutRows.values()) {
        if (cursorY + 25 > bottom()) {
          doc.addPage();
          cursorY = drawHeader(true);
          cursorY = drawTableHeader(cutHeaders, cutWidths, cursorY);
        }
        cutIndex += 1;
        cursorY = drawRow([
          String(cutIndex), row.code, row.name, formatDecimal(row.length, 0), formatDecimal(row.quantity, 0), row.angle, row.door, '',
        ], cutWidths, cursorY, 25, ['center', 'left', 'left', 'right', 'center', 'center', 'left', 'left']);
      }

      if (cursorY + 76 > bottom()) {
        doc.addPage();
        cursorY = drawHeader(true);
      } else {
        cursorY += 10;
      }
      cursorY = drawSectionTitle('SƠ ĐỒ GHÉP CẮT THEO CÂY / DC', cursorY);
      const layoutWidths = [30, 70, 55, 320, 70, 70, 78, 100];
      const layoutHeaders = ['STT', 'MÃ THANH', 'NGUỒN', 'CÁC ĐOẠN CẮT TRÊN CÂY', 'ĐÃ DÙNG', 'CÒN LẠI', 'PHÂN LOẠI', 'TỶ TRỌNG'];
      cursorY = drawTableHeader(layoutHeaders, layoutWidths, cursorY);
      let layoutIndex = 0;
      for (const material of plan.materials) {
        for (const layout of material.barLayouts || []) {
          if (cursorY + 28 > bottom()) {
            doc.addPage();
            cursorY = drawHeader(true);
            cursorY = drawTableHeader(layoutHeaders, layoutWidths, cursorY);
          }
          layoutIndex += 1;
          const cuts = layout.cuts.map((cut) => `${formatDecimal(cut.lengthMm, 0)} (${cut.doorName || '-'})`).join(' + ');
          cursorY = drawRow([
            String(layoutIndex),
            material.materialCode,
            layout.isDeXe ? 'DC kho' : 'Cây mới',
            cuts,
            `${formatDecimal(layout.usedLengthMm, 0)} mm`,
            `${formatDecimal(layout.remainingLengthMm, 0)} mm`,
            layout.isNewDeXe ? 'Lưu DC' : 'Vụn',
            `${formatDecimal(material.kgPerMeter, 3)} kg/m`,
          ], layoutWidths, cursorY, 28, ['center', 'left', 'center', 'left', 'right', 'right', 'center', 'right']);
        }
      }

      if (cursorY + 78 > bottom()) {
        doc.addPage();
        cursorY = drawHeader(true);
      } else {
        cursorY += 14;
      }
      const signWidth = contentWidth / 3;
      ['NGƯỜI LẬP PHIẾU', 'TỔ TRƯỞNG SẢN XUẤT', 'THỢ CẮT'].forEach((label, index) => {
        const x = left + signWidth * index;
        doc.font('bold').fontSize(8.5).fillColor(PDF_COLORS.ink).text(label, x, cursorY, { width: signWidth, align: 'center' });
        doc.font('body').fontSize(7.4).fillColor(PDF_COLORS.muted).text('(Ký, ghi rõ họ tên)', x, cursorY + 15, { width: signWidth, align: 'center' });
      });

      addPdfPageFooters(doc, plan.planRef, issuerName);
      doc.end();
    });
  }
}
