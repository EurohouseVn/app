import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { QuotationRecord } from '@eurohouse/types';
import {
  PDF_COLORS,
  addPdfPageFooters,
  formatMoney,
  formatPdfDate,
  loadPdfLogo,
  moneyInWords,
  registerPdfFonts,
  type PdfIssuerProfile,
} from '../../common/pdf-document.util';

export interface ContractTermsInput {
  contractNumber?: string;
  constructionDays?: string;
  advanceAmount?: string | number;
  paymentTerms?: string;
  paymentCommitment?: string;
  warrantyTerms?: string;
  customTerms?: string;
}

@Injectable()
export class QuotationContractPdfService {
  async render(quotation: QuotationRecord, profile: PdfIssuerProfile | null, input: ContractTermsInput = {}): Promise<Buffer> {
    const logo = await loadPdfLogo(profile || undefined);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true, info: { Title: `Hợp đồng ${quotation.code}`, Author: profile?.productionName || profile?.name || 'EUROHOUSE Workshop OS' } });
      registerPdfFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const left = 36;
      const width = doc.page.width - 72;
      const bottom = () => doc.page.height - 48;
      const issuerName = profile?.productionName || profile?.name || 'CƠ SỞ SẢN XUẤT NHÔM KÍNH';
      const contractNumber = input.contractNumber?.trim() || `HĐ-${quotation.code}`;
      const advanceText = String(input.advanceAmount ?? '').trim();
      const constructionDays = input.constructionDays?.trim() || 'Theo tiến độ hai bên thống nhất';

      const header = (continued = false) => {
        if (continued) {
          doc.font('bold').fontSize(9).fillColor(PDF_COLORS.ink).text(issuerName, left, 34, { width: width * 0.55 });
          doc.font('bold').fontSize(9).fillColor(PDF_COLORS.orange).text(`${contractNumber} - tiếp theo`, left, 34, { width, align: 'right' });
          doc.moveTo(left, 53).lineTo(left + width, 53).strokeColor(PDF_COLORS.line).stroke();
          return 66;
        }
        if (logo) {
          try { doc.image(logo, left, 34, { fit: [48, 48] }); } catch { /* Logo không hợp lệ không được chặn hợp đồng. */ }
        }
        const textX = logo ? left + 60 : left;
        doc.font('bold').fontSize(11).fillColor(PDF_COLORS.ink).text(issuerName.toUpperCase(), textX, 35, { width: width - (textX - left) });
        doc.font('body').fontSize(7.8).fillColor(PDF_COLORS.muted)
          .text([profile?.address, profile?.phone, profile?.email].filter(Boolean).join(' | '), textX, 53, { width: width - (textX - left) });
        doc.font('bold').fontSize(15).fillColor(PDF_COLORS.ink).text('HỢP ĐỒNG THI CÔNG NHÔM KÍNH', left, 83, { width, align: 'center' });
        doc.font('body').fontSize(8.7).fillColor(PDF_COLORS.text).text(`Số: ${contractNumber}`, left, 106, { width, align: 'center' });
        doc.font('body').fontSize(7.8).fillColor(PDF_COLORS.muted).text(`Lập ngày ${formatPdfDate(new Date())}`, left, 122, { width, align: 'center' });
        return 143;
      };

      const ensure = (y: number, needed: number) => {
        if (y + needed <= bottom()) return y;
        doc.addPage();
        return header(true);
      };
      const section = (title: string, body: string, y: number) => {
        y = ensure(y, 44);
        doc.font('bold').fontSize(10).fillColor(PDF_COLORS.ink).text(title, left, y, { width });
        y = doc.y + 3;
        doc.font('body').fontSize(8.25).fillColor(PDF_COLORS.text).text(body, left, y, { width, lineGap: 1.5, align: 'justify' });
        return doc.y + 8;
      };

      let y = header();
      doc.font('body').fontSize(9).fillColor(PDF_COLORS.text)
        .text('Căn cứ nhu cầu thi công thực tế và sự tự nguyện thỏa thuận của hai bên, hôm nay các bên thống nhất ký hợp đồng với nội dung sau:', left, y, { width, lineGap: 3 });
      y = doc.y + 12;

      const party = (label: string, lines: string[], cursor: number) => {
        doc.roundedRect(left, cursor, width, 60, 5).fillAndStroke(PDF_COLORS.soft, PDF_COLORS.line);
        doc.font('bold').fontSize(9.5).fillColor(PDF_COLORS.orange).text(label, left + 10, cursor + 9, { width: width - 20 });
        doc.font('body').fontSize(8).fillColor(PDF_COLORS.text).text(lines.join('\n'), left + 10, cursor + 25, { width: width - 20, lineGap: 1.5 });
        return cursor + 68;
      };
      y = party('BÊN A - CHỦ ĐẦU TƯ / KHÁCH HÀNG', [
        `Họ tên: ${quotation.customerName || '........................................................'}`,
        `Điện thoại: ${quotation.customerPhone || '........................'}    Địa chỉ: ${quotation.customerAddress || '........................................................'}`,
      ], y);
      y = party('BÊN B - ĐƠN VỊ THI CÔNG', [
        `Tên cơ sở: ${issuerName}`,
        `Điện thoại: ${profile?.phone || '........................'}    Địa chỉ: ${profile?.address || '........................................................'}`,
      ], y);

      y = section('ĐIỀU 1. PHẠM VI CÔNG VIỆC', `Bên B cung cấp vật tư, gia công và thi công các hạng mục nhôm kính theo Báo giá ${quotation.code} đính kèm. Báo giá, bản vẽ được hai bên xác nhận và các phụ lục phát sinh hợp lệ là bộ phận không tách rời của hợp đồng.`, y);
      y = section('ĐIỀU 2. GIÁ TRỊ HỢP ĐỒNG', `Tổng giá trị dự kiến: ${formatMoney(quotation.totalAmount)} (${moneyInWords(quotation.totalAmount)}). Giá trị quyết toán căn cứ khối lượng thực tế nghiệm thu và các phát sinh được hai bên xác nhận bằng văn bản.`, y);
      y = section('ĐIỀU 3. TẠM ỨNG VÀ THANH TOÁN', `Mức tạm ứng: ${advanceText ? `${formatMoney(Number(advanceText.replace(/[^\d.-]/g, '')) || 0)}` : '........................................................'}\n${input.paymentTerms?.trim() || 'Tiến độ thanh toán do hai bên điền và xác nhận trước khi ký. Các khoản thanh toán phải có chứng từ hoặc xác nhận hợp lệ.'}\nCam kết thanh toán: ${input.paymentCommitment?.trim() || 'Bên A thanh toán đúng tiến độ đã thỏa thuận; phần chậm thanh toán được hai bên xử lý theo biên bản đối chiếu.'}`, y);
      y = section('ĐIỀU 4. THỜI GIAN VÀ ĐIỀU KIỆN THI CÔNG', `Thời gian thực hiện: ${constructionDays}. Thời gian được tính từ khi Bên B nhận đủ tạm ứng, mặt bằng và số liệu kỹ thuật đã chốt. Tiến độ có thể điều chỉnh khi có thay đổi thiết kế, phát sinh khối lượng, điều kiện bất khả kháng hoặc mặt bằng chưa sẵn sàng.`, y);
      y = section('ĐIỀU 5. CHẤT LƯỢNG, NGHIỆM THU VÀ BẢO HÀNH', `${input.warrantyTerms?.trim() || 'Vật tư và sản phẩm phải đúng chủng loại đã duyệt. Hai bên nghiệm thu theo khối lượng và hiện trạng thực tế. Bên B bảo hành lỗi kỹ thuật thuộc phạm vi thi công; hư hỏng do sử dụng sai, tác động ngoại lực hoặc bên thứ ba không thuộc trách nhiệm bảo hành.'}`, y);
      y = section('ĐIỀU 6. TRÁCH NHIỆM CỦA CÁC BÊN', 'Bên A cung cấp mặt bằng, nguồn điện nước và phối hợp xác nhận kỹ thuật đúng thời hạn. Bên B tổ chức sản xuất, thi công an toàn, bảo quản khu vực làm việc và thông báo kịp thời các vấn đề ảnh hưởng tiến độ hoặc chất lượng.', y);
      y = section('ĐIỀU 7. ĐIỀU KHOẢN CHUNG', `${input.customTerms?.trim() || 'Mọi sửa đổi phải được hai bên xác nhận. Tranh chấp trước hết được giải quyết bằng thương lượng; nếu không thành, các bên thực hiện theo quy định pháp luật hiện hành. Hợp đồng có hiệu lực từ ngày ký và được lập thành 02 bản có giá trị như nhau.'}`, y);

      y = ensure(y, 105);
      const signWidth = width / 2;
      ['ĐẠI DIỆN BÊN A', 'ĐẠI DIỆN BÊN B'].forEach((label, index) => {
        doc.font('bold').fontSize(9.5).fillColor(PDF_COLORS.ink).text(label, left + index * signWidth, y, { width: signWidth, align: 'center' });
        doc.font('body').fontSize(7.8).fillColor(PDF_COLORS.muted).text('(Ký, ghi rõ họ tên)', left + index * signWidth, y + 16, { width: signWidth, align: 'center' });
      });

      addPdfPageFooters(doc, contractNumber, issuerName);
      doc.end();
    });
  }
}
