import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PDF_COLORS, addPdfPageFooters, formatMoney, formatPdfDate, loadPdfLogo, registerPdfFonts, type PdfIssuerProfile } from '../../common/pdf-document.util';

type AcceptanceProject = {
  code: string; name: string; customerName: string; customerPhone: string; address: string; productsUsed: string;
  contractValue: number; estimatedValue: number; settledValue: number; note: string; issuer?: PdfIssuerProfile | null;
};

@Injectable()
export class ProjectAcceptancePdfService {
  async render(project: AcceptanceProject): Promise<Buffer> {
    const logo = await loadPdfLogo(project.issuer || undefined);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true, info: { Title: `Biên bản nghiệm thu ${project.code}` } });
      registerPdfFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      const left = 44;
      const width = doc.page.width - 88;
      const issuerName = project.issuer?.productionName || project.issuer?.name || 'CƠ SỞ SẢN XUẤT NHÔM KÍNH';

      if (logo) {
        try { doc.image(logo, left, 36, { fit: [48, 48] }); } catch { /* Bỏ qua logo lỗi. */ }
      }
      const x = logo ? left + 60 : left;
      doc.font('bold').fontSize(11).fillColor(PDF_COLORS.ink).text(issuerName.toUpperCase(), x, 38, { width: width - (x - left) });
      doc.font('body').fontSize(7.8).fillColor(PDF_COLORS.muted).text([project.issuer?.address, project.issuer?.phone].filter(Boolean).join(' | '), x, 57, { width: width - (x - left) });
      doc.font('bold').fontSize(16).fillColor(PDF_COLORS.ink).text('BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO', left, 102, { width, align: 'center' });
      doc.font('body').fontSize(9).fillColor(PDF_COLORS.text).text(`Công trình: ${project.name} | Mã: ${project.code}`, left, 130, { width, align: 'center' });

      let y = 165;
      const info = [
        ['Chủ đầu tư / Khách hàng', project.customerName || '........................................................'],
        ['Điện thoại', project.customerPhone || '........................'],
        ['Địa điểm thi công', project.address || '........................................................'],
        ['Đơn vị thi công', issuerName],
        ['Ngày nghiệm thu', formatPdfDate(new Date())],
      ];
      doc.roundedRect(left, y, width, 112, 6).fillAndStroke(PDF_COLORS.soft, PDF_COLORS.line);
      info.forEach(([label, value], index) => {
        doc.font('bold').fontSize(8.5).fillColor(PDF_COLORS.muted).text(label, left + 12, y + 11 + index * 20, { width: 145 });
        doc.font('body').fontSize(8.8).fillColor(PDF_COLORS.text).text(value, left + 160, y + 11 + index * 20, { width: width - 172 });
      });
      y += 132;

      const section = (title: string, body: string) => {
        doc.font('bold').fontSize(10).fillColor(PDF_COLORS.ink).text(title, left, y, { width });
        y = doc.y + 6;
        doc.font('body').fontSize(9).fillColor(PDF_COLORS.text).text(body, left, y, { width, lineGap: 4, align: 'justify' });
        y = doc.y + 16;
      };
      section('1. PHẠM VI NGHIỆM THU', `Hai bên tiến hành kiểm tra và nghiệm thu các hạng mục: ${project.productsUsed || 'nhôm kính theo hợp đồng, báo giá và hồ sơ kỹ thuật đã thống nhất'}.`);
      section('2. KẾT QUẢ KIỂM TRA', 'Sản phẩm được kiểm tra về chủng loại, số lượng, kích thước, vận hành, bề mặt hoàn thiện, kính, phụ kiện và chất lượng lắp đặt. Kết quả: ........................................................................................................................\n......................................................................................................................................................');
      section('3. TỒN TẠI VÀ THỜI HẠN KHẮC PHỤC', '......................................................................................................................................................\n......................................................................................................................................................');
      section('4. GIÁ TRỊ XÁC NHẬN', `Giá trị công trình/giá trị quyết toán tại thời điểm nghiệm thu: ${formatMoney(project.settledValue || project.contractValue || project.estimatedValue)}. Các khoản còn phải thanh toán được thực hiện theo hợp đồng và đối chiếu công nợ giữa hai bên.`);
      section('5. KẾT LUẬN', 'Hai bên thống nhất công việc đủ điều kiện bàn giao đưa vào sử dụng, ngoại trừ các tồn tại đã ghi rõ tại Mục 3. Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.');

      y = Math.max(y + 8, 650);
      const signWidth = width / 2;
      ['ĐẠI DIỆN KHÁCH HÀNG', 'ĐẠI DIỆN ĐƠN VỊ THI CÔNG'].forEach((label, index) => {
        doc.font('bold').fontSize(9.5).fillColor(PDF_COLORS.ink).text(label, left + index * signWidth, y, { width: signWidth, align: 'center' });
        doc.font('body').fontSize(7.8).fillColor(PDF_COLORS.muted).text('(Ký, ghi rõ họ tên)', left + index * signWidth, y + 16, { width: signWidth, align: 'center' });
      });
      addPdfPageFooters(doc, project.code, issuerName);
      doc.end();
    });
  }
}
