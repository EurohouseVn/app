import { Injectable } from '@nestjs/common';
import { join } from 'path';
import PDFDocument from 'pdfkit';

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');

export interface OrderPdfItem {
  profileCode: string;
  productName: string;
  colorCode: string;
  quantity: number;
  totalKg: number;
  kgPerMeter?: number;
  theoreticalTotalKg?: number;
  barsPerBundle?: number;
}

export interface OrderPdfData {
  code: string;
  title?: string;
  issuerName?: string;
  issuerAddress?: string;
  issuerPhone?: string;
  issuerEmail?: string;
  issuerCategories?: string;
  customerCode: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  invoiceNo: string;
  poNo: string;
  debtAmount?: number;
  actualTotalKg?: number;
  accessoriesNote?: string;
  signatureLabels?: [string, string, string];
  createdAt: Date | string;
  colorNameByCode: Record<string, string>;
  items: OrderPdfItem[];
}

interface ColorSummaryRow {
  code: string;
  name: string;
  theoreticalKg: number;
}

interface PivotRow {
  profileCode: string;
  productName: string;
  kgPerMeter: number;
  barsPerBundle: number;
  byColor: Record<string, number>;
  total: number;
}

const COMPANY_NAME = 'CÔNG TY EUROHOUSE';
const COMPANY_DESCRIPTION = 'Hệ thống nhôm kính Eurohouse';

function formatKg(value: number): string {
  return value.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')} đ`;
}

@Injectable()
export class OrderPdfService {
  render(order: OrderPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
      doc.registerFont('body', join(FONT_DIR, 'NotoSans-Regular.ttf'));
      doc.registerFont('bold', join(FONT_DIR, 'NotoSans-Bold.ttf'));

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const width = right - left;
      const colors = this.orderColors(order);

      this.header(doc, order, left, width);
      this.infoBlock(doc, order, left, right, width);
      this.colorSummaryTable(doc, order, this.buildColorSummary(order, colors), left, width);
      this.pivotTable(doc, order, this.buildPivot(order, colors), colors, left, width);
      this.signatures(doc, order.signatureLabels, left, width);
      doc.end();
    });
  }

  private orderColors(order: OrderPdfData): string[] {
    return Array.from(new Set(order.items.map((item) => item.colorCode || '')));
  }

  private colorLabel(order: OrderPdfData, code: string): string {
    if (!code) return '(Không màu)';
    return order.colorNameByCode[code] || code;
  }

  private buildColorSummary(order: OrderPdfData, colors: string[]): ColorSummaryRow[] {
    return colors.map((code) => ({
      code,
      name: this.colorLabel(order, code),
      theoreticalKg: order.items
        .filter((item) => (item.colorCode || '') === code)
        .reduce((sum, item) => sum + (item.theoreticalTotalKg ?? item.totalKg ?? 0), 0),
    }));
  }

  private buildPivot(order: OrderPdfData, colors: string[]): PivotRow[] {
    const rows = new Map<string, PivotRow>();
    for (const item of order.items) {
      const key = item.profileCode || item.productName;
      const row = rows.get(key) ?? {
        profileCode: item.profileCode || '',
        productName: item.productName,
        kgPerMeter: item.kgPerMeter ?? 0,
        barsPerBundle: item.barsPerBundle ?? 0,
        byColor: Object.fromEntries(colors.map((color) => [color, 0])),
        total: 0,
      };
      const color = item.colorCode || '';
      row.byColor[color] = (row.byColor[color] || 0) + (item.quantity || 0);
      row.total += item.quantity || 0;
      rows.set(key, row);
    }
    return Array.from(rows.values());
  }

  private header(doc: PDFKit.PDFDocument, order: OrderPdfData, left: number, width: number) {
    const topY = doc.y;
    const issuerName = order.issuerName || COMPANY_NAME;
    const issuerDescription = order.issuerCategories || COMPANY_DESCRIPTION;
    const issuerContact = [order.issuerAddress, order.issuerPhone, order.issuerEmail].filter(Boolean).join(' | ');

    doc.font('bold').fontSize(11).fillColor('#B71C1C').text(issuerName, left, topY, { width: width * 0.62 });
    doc.font('body').fontSize(8).fillColor('#555').text(issuerDescription, left, topY + 14, { width: width * 0.62 });
    if (issuerContact) doc.text(issuerContact, left, topY + 27, { width: width * 0.62 });
    doc.font('body').fontSize(9).fillColor('#333').text(`Số phiếu: ${order.code}`, left, topY, { width, align: 'right' });
    doc.text(`Ngày: ${new Date(order.createdAt).toLocaleDateString('vi-VN')}`, left, topY + 14, { width, align: 'right' });
    doc.fillColor('#000');
    doc.y = topY + 43;
    doc.font('bold').fontSize(17).text(order.title || 'PHIẾU ĐẶT HÀNG', left, doc.y, { width, align: 'center' });
    doc.moveDown(0.65);
  }

  private infoBlock(doc: PDFKit.PDFDocument, order: OrderPdfData, left: number, right: number, width: number) {
    const startY = doc.y;
    const columnWidth = width / 2;
    const rowHeight = 15;
    const line = (label: string, value: string, x: number, y: number, lineWidth: number) => {
      doc.font('bold').fontSize(9).fillColor('#000').text(label, x, y, { width: 105 });
      doc.font('body').fontSize(9).fillColor('#222').text(value || '-', x + 105, y, { width: lineWidth - 105 });
    };

    line('Mã khách hàng:', order.customerCode, left, startY, columnWidth);
    line('Tên khách hàng:', order.customerName, left, startY + rowHeight, columnWidth);
    line('Địa chỉ:', order.deliveryAddress, left, startY + rowHeight * 2, columnWidth);
    line('Điện thoại:', order.customerPhone, left, startY + rowHeight * 3, columnWidth);
    const rightX = left + columnWidth + 10;
    line('Số phiếu:', order.code, rightX, startY, columnWidth - 10);
    line('Số hóa đơn:', order.invoiceNo, rightX, startY + rowHeight, columnWidth - 10);
    line('Số đơn đặt hàng:', order.poNo, rightX, startY + rowHeight * 2, columnWidth - 10);
    if (order.debtAmount !== undefined) line('Giá trị/Công nợ:', formatMoney(order.debtAmount), rightX, startY + rowHeight * 3, columnWidth - 10);
    if (order.accessoriesNote) line('Phụ kiện:', order.accessoriesNote, left, startY + rowHeight * 4, width);

    doc.y = startY + rowHeight * (order.accessoriesNote ? 5 : 4) + 5;
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#CCC').stroke();
    doc.moveDown(0.6);
  }

  private drawTableRow(
    doc: PDFKit.PDFDocument,
    cells: string[],
    xs: number[],
    aligns: ('left' | 'right' | 'center')[],
    y: number,
    options: { header?: boolean; bold?: boolean; fill?: string } = {},
  ): number {
    const rowHeight = options.header ? 26 : 17;
    if (options.fill) doc.rect(xs[0], y, xs[xs.length - 1] - xs[0], rowHeight).fillColor(options.fill).fill();
    doc.fillColor('#000').font(options.header || options.bold ? 'bold' : 'body').fontSize(options.header ? 7.5 : 8.3);
    cells.forEach((cell, index) => {
      const cellWidth = xs[index + 1] - xs[index];
      doc.text(cell ?? '', xs[index] + 3, y + (options.header ? 5 : 4), {
        width: cellWidth - 6, align: aligns[index], lineBreak: false, height: rowHeight - 4, ellipsis: true,
      });
    });
    doc.strokeColor('#999').lineWidth(0.5);
    for (const x of xs) doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
    doc.moveTo(xs[0], y).lineTo(xs[xs.length - 1], y).stroke();
    doc.moveTo(xs[0], y + rowHeight).lineTo(xs[xs.length - 1], y + rowHeight).stroke();
    doc.y = y + rowHeight;
    return rowHeight;
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed: number): { y: number; newPage: boolean } {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      return { y: doc.y, newPage: true };
    }
    return { y: doc.y, newPage: false };
  }

  private colorSummaryTable(doc: PDFKit.PDFDocument, order: OrderPdfData, rows: ColorSummaryRow[], left: number, width: number) {
    doc.font('bold').fontSize(10).text('Bảng tổng hợp khối lượng theo màu', left, doc.y);
    doc.moveDown(0.3);
    const widths = [0.08, 0.18, 0.46, 0.1, 0.18].map((fraction) => fraction * width);
    const xs = [left];
    widths.forEach((cellWidth) => xs.push(xs[xs.length - 1] + cellWidth));
    const aligns: ('left' | 'right' | 'center')[] = ['center', 'left', 'left', 'center', 'right'];

    let y = doc.y;
    y += this.drawTableRow(doc, ['STT', 'Mã màu', 'Tên màu', 'ĐVT', 'Theo tỷ trọng (kg)'], xs, aligns, y, { header: true, fill: '#EDEDED' });
    const theoreticalTotalKg = rows.reduce((sum, row) => sum + row.theoreticalKg, 0);
    rows.forEach((row, index) => {
      doc.y = y;
      y = this.ensureSpace(doc, 17).y;
      y += this.drawTableRow(doc, [String(index + 1), row.code || '-', row.name, 'kg', formatKg(row.theoreticalKg)], xs, aligns, y);
    });
    y += this.drawTableRow(doc, ['', '', 'TỔNG THEO TỶ TRỌNG', '', formatKg(theoreticalTotalKg)], xs, aligns, y, { bold: true, fill: '#F7F7F7' });
    if (order.actualTotalKg !== undefined && order.actualTotalKg > 0) {
      y += this.drawTableRow(doc, ['', '', 'TỔNG KG THỰC TẾ CÂN', '', formatKg(order.actualTotalKg)], xs, aligns, y, { bold: true, fill: '#FFF3E7' });
    }
    doc.y = y + 12;
  }

  private pivotTable(doc: PDFKit.PDFDocument, order: OrderPdfData, rows: PivotRow[], colors: string[], left: number, width: number) {
    this.ensureSpace(doc, 60);
    doc.font('bold').fontSize(10).text('Bảng chi tiết theo cây nhôm', left, doc.y);
    doc.moveDown(0.3);
    const fixedFractions = [0.05, 0.11, 0.24, 0.08, 0.08];
    const variableFraction = (1 - fixedFractions.reduce((sum, value) => sum + value, 0)) / Math.max(colors.length + 1, 1);
    const widths = [...fixedFractions, ...colors.map(() => variableFraction), variableFraction].map((fraction) => fraction * width);
    const xs = [left];
    widths.forEach((cellWidth) => xs.push(xs[xs.length - 1] + cellWidth));
    const headers = ['STT', 'Mã VT', 'Tên mô tả', 'Tỷ trọng', 'Quy cách', ...colors.map((color) => this.colorLabel(order, color)), 'Tổng'];
    const aligns: ('left' | 'right' | 'center')[] = ['center', 'left', 'left', 'center', 'center', ...colors.map(() => 'center' as const), 'center'];

    let y = doc.y;
    y += this.drawTableRow(doc, headers, xs, aligns, y, { header: true, fill: '#EDEDED' });
    const totals = Object.fromEntries(colors.map((color) => [color, 0])) as Record<string, number>;
    let grandTotal = 0;
    rows.forEach((row, index) => {
      doc.y = y;
      const space = this.ensureSpace(doc, 17);
      y = space.y;
      if (space.newPage) y += this.drawTableRow(doc, headers, xs, aligns, y, { header: true, fill: '#EDEDED' });
      const colorCells = colors.map((color) => {
        const quantity = row.byColor[color] || 0;
        totals[color] += quantity;
        return quantity ? String(quantity) : '';
      });
      grandTotal += row.total;
      y += this.drawTableRow(doc, [String(index + 1), row.profileCode || '-', row.productName,
        row.kgPerMeter ? row.kgPerMeter.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : '-',
        row.barsPerBundle ? String(row.barsPerBundle) : '-', ...colorCells, String(row.total)], xs, aligns, y);
    });
    y += this.drawTableRow(doc, ['', '', 'TỔNG CỘNG', '', '', ...colors.map((color) => String(totals[color] || 0)), String(grandTotal)], xs, aligns, y, { bold: true, fill: '#F7F7F7' });
    doc.y = y + 16;
  }

  private signatures(doc: PDFKit.PDFDocument, labels: [string, string, string] | undefined, left: number, width: number) {
    this.ensureSpace(doc, 70);
    const y = doc.y + 8;
    const columnWidth = width / 3;
    const signatureLabels = labels ?? ['NGƯỜI LẬP PHIẾU', 'NGƯỜI NHẬN HÀNG', 'THỦ KHO'];
    doc.font('bold').fontSize(9.5);
    signatureLabels.forEach((label, index) => doc.text(label, left + columnWidth * index, y, { width: columnWidth, align: 'center' }));
    doc.font('body').fontSize(8).fillColor('#888');
    signatureLabels.forEach((_, index) => doc.text('(Ký, ghi rõ họ tên)', left + columnWidth * index, y + 15, { width: columnWidth, align: 'center' }));
    doc.fillColor('#000');
  }
}
