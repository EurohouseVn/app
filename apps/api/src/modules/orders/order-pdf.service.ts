import { Injectable } from '@nestjs/common';
import { join } from 'path';
import PDFDocument from 'pdfkit';

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');

export interface OrderPdfItem {
  profileCode: string; // mÃ£ cÃ¢y (MÃ£ VT á»Ÿ báº£ng pivot)
  productName: string;
  colorCode: string;
  quantity: number;
  totalKg: number;
  kgPerMeter?: number; // tá»· trá»ng kg/m
  barsPerBundle?: number; // quy cÃ¡ch cÃ¢y/bÃ³
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
  accessoriesNote?: string;
  signatureLabels?: [string, string, string];
  createdAt: Date | string;
  colorNameByCode: Record<string, string>;
  items: OrderPdfItem[];
}

const COMPANY_NAME = 'CONG TY EUROHOUSE';
const COMPANY_ADDR = 'He thong nhom kinh Eurohouse';

function fmtKg(value: number): string {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}

interface ColorSummaryRow {
  code: string;
  name: string;
  kg: number;
}

interface PivotRow {
  profileCode: string;
  productName: string;
  kgPerMeter: number;
  barsPerBundle: number;
  byColor: Record<string, number>; // colorCode -> tá»•ng sá»‘ cÃ¢y
  total: number;
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
      const colorSummary = this.buildColorSummary(order, colors);
      const pivot = this.buildPivot(order, colors);

      this.header(doc, order, left, right, width);
      this.infoBlock(doc, order, left, right, width);
      this.colorSummaryTable(doc, colorSummary, left, width);
      this.pivotTable(doc, order, pivot, colors, left, right, width);
      this.signatures(doc, order.signatureLabels, left, width);

      doc.end();
    });
  }

  // Danh sÃ¡ch mÃ£ mÃ u xuáº¥t hiá»‡n trong Ä‘Æ¡n, giá»¯ thá»© tá»± xuáº¥t hiá»‡n
  private orderColors(order: OrderPdfData): string[] {
    const seen: string[] = [];
    for (const it of order.items) {
      const c = it.colorCode || '';
      if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }

  private colorLabel(order: OrderPdfData, code: string): string {
    if (!code) return '(KhÃ´ng mÃ u)';
    return order.colorNameByCode[code] || code;
  }

  private buildColorSummary(order: OrderPdfData, colors: string[]): ColorSummaryRow[] {
    return colors.map((code) => {
      const kg = order.items
        .filter((it) => (it.colorCode || '') === code)
        .reduce((s, it) => s + (it.totalKg || 0), 0);
      return { code, name: this.colorLabel(order, code), kg };
    });
  }

  private buildPivot(order: OrderPdfData, colors: string[]): PivotRow[] {
    const map = new Map<string, PivotRow>();
    for (const it of order.items) {
      const key = it.profileCode || it.productName;
      let row = map.get(key);
      if (!row) {
        row = {
          profileCode: it.profileCode || '',
          productName: it.productName,
          kgPerMeter: it.kgPerMeter ?? 0,
          barsPerBundle: it.barsPerBundle ?? 0,
          byColor: {},
          total: 0,
        };
        colors.forEach((c) => (row!.byColor[c] = 0));
        map.set(key, row);
      }
      const c = it.colorCode || '';
      row.byColor[c] = (row.byColor[c] || 0) + (it.quantity || 0);
      row.total += it.quantity || 0;
    }
    return Array.from(map.values());
  }

  private header(doc: PDFKit.PDFDocument, order: OrderPdfData, left: number, right: number, width: number) {
    const topY = doc.y;
    const issuerName = order.issuerName || COMPANY_NAME;
    const issuerLine1 = order.issuerCategories || COMPANY_ADDR;
    const issuerLine2 = [order.issuerAddress, order.issuerPhone, order.issuerEmail].filter(Boolean).join(' | ');
    doc.font('bold').fontSize(11).fillColor('#B71C1C').text(issuerName, left, topY, { width: width * 0.58 });
    doc.font('body').fontSize(8).fillColor('#555').text(issuerLine1, left, topY + 13, { width: width * 0.58 });
    if (issuerLine2) doc.text(issuerLine2, left, topY + 25, { width: width * 0.58 });
    doc.fillColor('#000');

    // Sá»‘ phiáº¿u gÃ³c pháº£i
    doc.font('body').fontSize(9).fillColor('#333')
      .text(`Sá»‘ phiáº¿u: ${order.code}`, left, topY, { width, align: 'right' });
    doc.text(`NgÃ y: ${new Date(order.createdAt).toLocaleDateString('vi-VN')}`, left, topY + 13, { width, align: 'right' });
    doc.fillColor('#000');

    doc.moveDown(1);
    doc.font('bold').fontSize(17).text(order.title || 'PHIEU DAT HANG', left, doc.y, { width, align: 'center' });
    doc.moveDown(0.8);
  }

  private infoBlock(doc: PDFKit.PDFDocument, order: OrderPdfData, left: number, right: number, width: number) {
    const startY = doc.y;
    const colW = width / 2;
    const line = (label: string, value: string, x: number, y: number, w: number) => {
      doc.font('bold').fontSize(9.5).fillColor('#000').text(label, x, y, { width: 95, continued: false });
      doc.font('body').fontSize(9.5).fillColor('#222').text(value || 'â€”', x + 95, y, { width: w - 95 });
      doc.fillColor('#000');
    };
    const rowH = 15;
    // Cá»™t trÃ¡i: khÃ¡ch hÃ ng
    line('MÃ£ khÃ¡ch hÃ ng:', order.customerCode, left, startY, colW);
    line('TÃªn khÃ¡ch hÃ ng:', order.customerName, left, startY + rowH, colW);
    line('Äá»‹a chá»‰:', order.deliveryAddress, left, startY + rowH * 2, colW);
    line('Äiá»‡n thoáº¡i:', order.customerPhone, left, startY + rowH * 3, colW);
    // Cá»™t pháº£i: chá»©ng tá»«
    const rx = left + colW + 10;
    line('Sá»‘ phiáº¿u:', order.code, rx, startY, colW - 10);
    line('Sá»‘ hÃ³a Ä‘Æ¡n:', order.invoiceNo, rx, startY + rowH, colW - 10);
    line('Sá»‘ Ä‘Æ¡n Ä‘áº·t hÃ ng:', order.poNo, rx, startY + rowH * 2, colW - 10);

    if (order.debtAmount !== undefined) line('Cong no:', order.debtAmount.toLocaleString('vi-VN') + ' d', rx, startY + rowH * 3, colW - 10);
    if (order.accessoriesNote) line('Phu kien:', order.accessoriesNote, left, startY + rowH * 4, width);

    doc.y = startY + rowH * (order.accessoriesNote ? 5 : 4) + 4;
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#CCC').stroke();
    doc.moveDown(0.6);
  }

  // Váº½ 1 dÃ²ng báº£ng cÃ³ viá»n, sá»‘ cá»™t Ä‘á»™ng. Tráº£ vá» chiá»u cao dÃ²ng.
  private drawTableRow(
    doc: PDFKit.PDFDocument,
    cells: string[],
    xs: number[], // vá»‹ trÃ­ x mÃ©p trÃ¡i má»—i cá»™t (+ mÃ©p pháº£i cuá»‘i á»Ÿ cuá»‘i máº£ng)
    aligns: ('left' | 'right' | 'center')[],
    y: number,
    opts: { header?: boolean; bold?: boolean; fill?: string } = {},
  ): number {
    const rowH = opts.header ? 26 : 16;
    const totalW = xs[xs.length - 1] - xs[0];
    if (opts.fill) {
      doc.rect(xs[0], y, totalW, rowH).fillColor(opts.fill).fill();
    }
    doc.fillColor('#000');
    doc.font(opts.header || opts.bold ? 'bold' : 'body').fontSize(opts.header ? 8 : 8.5);
    for (let i = 0; i < cells.length; i++) {
      const cw = xs[i + 1] - xs[i];
      const pad = 3;
      const textY = opts.header ? y + 5 : y + 4;
      doc.text(cells[i] ?? '', xs[i] + pad, textY, {
        width: cw - pad * 2,
        align: aligns[i],
        lineBreak: false,
        height: rowH - 4,
        ellipsis: true,
      });
    }
    // KhÃ´i phá»¥c y sau khi text() Ä‘áº©y doc.y
    doc.y = y;
    // viá»n dá»c + ngang
    doc.strokeColor('#999').lineWidth(0.5);
    for (const x of xs) {
      doc.moveTo(x, y).lineTo(x, y + rowH).stroke();
    }
    doc.moveTo(xs[0], y).lineTo(xs[xs.length - 1], y).stroke();
    doc.moveTo(xs[0], y + rowH).lineTo(xs[xs.length - 1], y + rowH).stroke();
    doc.y = y + rowH;
    return rowH;
  }

  // Tráº£ vá» { y, brokePage }. Náº¿u trÃ n trang, tá»± addPage vÃ  brokePage=true.
  private ensureSpace(doc: PDFKit.PDFDocument, needed: number): { y: number; brokePage: boolean } {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + needed > bottom) {
      doc.addPage();
      return { y: doc.y, brokePage: true };
    }
    return { y: doc.y, brokePage: false };
  }

  private colorSummaryTable(doc: PDFKit.PDFDocument, rows: ColorSummaryRow[], left: number, width: number) {
    doc.font('bold').fontSize(10).text('Báº£ng tá»•ng há»£p theo mÃ u', left, doc.y);
    doc.moveDown(0.3);

    // cá»™t: STT | MÃ£ VT | TÃªn mÃ´ táº£ | ÄVT | Thá»±c táº¿ (Kg)
    const w = [0.08, 0.18, 0.46, 0.1, 0.18].map((f) => f * width);
    const xs = [left];
    w.forEach((cw) => xs.push(xs[xs.length - 1] + cw));
    const aligns: ('left' | 'right' | 'center')[] = ['center', 'left', 'left', 'center', 'right'];

    let y = doc.y;
    y += this.drawTableRow(doc, ['STT', 'MÃ£ VT', 'TÃªn mÃ´ táº£', 'ÄVT', 'Thá»±c táº¿ (Kg)'], xs, aligns, y, {
      header: true,
      fill: '#EDEDED',
    });
    let totalKg = 0;
    rows.forEach((r, i) => {
      doc.y = y;
      const space = this.ensureSpace(doc, 16);
      y = space.y;
      totalKg += r.kg;
      y += this.drawTableRow(doc, [String(i + 1), r.code || 'â€”', r.name, 'Kg', fmtKg(r.kg)], xs, aligns, y);
    });
    // dÃ²ng tá»•ng
    y += this.drawTableRow(doc, ['', '', 'Tá»”NG Cá»˜NG', '', fmtKg(totalKg)], xs, aligns, y, {
      bold: true,
      fill: '#F7F7F7',
    });
    doc.y = y + 12;
  }

  private pivotTable(
    doc: PDFKit.PDFDocument,
    order: OrderPdfData,
    rows: PivotRow[],
    colors: string[],
    left: number,
    right: number,
    width: number,
  ) {
    this.ensureSpace(doc, 60);
    doc.font('bold').fontSize(10).text('Báº£ng chi tiáº¿t theo cÃ¢y nhÃ´m', left, doc.y);
    doc.moveDown(0.3);

    // Cá»™t cá»‘ Ä‘á»‹nh: STT, MÃ£ VT, TÃªn mÃ´ táº£, Tá»· trá»ng, Quy cÃ¡ch. Sau Ä‘Ã³ N cá»™t mÃ u + cá»™t Tá»•ng.
    const fixedLabels = ['STT', 'MÃ£ VT', 'TÃªn mÃ´ táº£', 'Tá»· trá»ng', 'Quy cÃ¡ch'];
    const fixedFrac = [0.05, 0.11, 0.24, 0.08, 0.08];
    const fixedW = fixedFrac.reduce((a, b) => a + b, 0);
    const remaining = 1 - fixedW;
    const colorColCount = Math.max(colors.length + 1, 1); // + cá»™t Tá»•ng
    const perColorFrac = remaining / colorColCount;

    const fracs = [...fixedFrac, ...colors.map(() => perColorFrac), perColorFrac];
    const w = fracs.map((f) => f * width);
    const xs = [left];
    w.forEach((cw) => xs.push(xs[xs.length - 1] + cw));

    const headerLabels = [
      ...fixedLabels,
      ...colors.map((c) => this.colorLabel(order, c)),
      'Tá»•ng',
    ];
    const aligns: ('left' | 'right' | 'center')[] = [
      'center', 'left', 'left', 'center', 'center',
      ...colors.map(() => 'center' as const),
      'center',
    ];

    let y = doc.y;
    y += this.drawTableRow(doc, headerLabels, xs, aligns, y, { header: true, fill: '#EDEDED' });

    const colTotals: Record<string, number> = {};
    colors.forEach((c) => (colTotals[c] = 0));
    let grandTotal = 0;

    rows.forEach((r, i) => {
      doc.y = y;
      const space = this.ensureSpace(doc, 16);
      y = space.y;
      if (space.brokePage) {
        // vá»«a sang trang má»›i: váº½ láº¡i header
        y += this.drawTableRow(doc, headerLabels, xs, aligns, y, { header: true, fill: '#EDEDED' });
      }
      const cells = [
        String(i + 1),
        r.profileCode || 'â€”',
        r.productName,
        r.kgPerMeter ? r.kgPerMeter.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : 'â€”',
        r.barsPerBundle ? String(r.barsPerBundle) : 'â€”',
        ...colors.map((c) => {
          const q = r.byColor[c] || 0;
          colTotals[c] += q;
          return q ? String(q) : '';
        }),
        String(r.total),
      ];
      grandTotal += r.total;
      y += this.drawTableRow(doc, cells, xs, aligns, y);
    });

    // dÃ²ng tá»•ng theo cá»™t mÃ u
    const totalCells = [
      '', '', 'Tá»”NG Cá»˜NG', '', '',
      ...colors.map((c) => (colTotals[c] ? String(colTotals[c]) : '0')),
      String(grandTotal),
    ];
    y += this.drawTableRow(doc, totalCells, xs, aligns, y, { bold: true, fill: '#F7F7F7' });
    doc.y = y + 16;
  }

  private signatures(doc: PDFKit.PDFDocument, labels: [string, string, string] | undefined, left: number, width: number) {
    this.ensureSpace(doc, 70);
    doc.moveDown(1);
    const y = doc.y;
    const third = width / 3;
    doc.font('bold').fontSize(9.5);
    const signatureLabels = labels ?? ['NGUOI LAP PHIEU', 'NGUOI NHAN HANG', 'THU KHO'];
    doc.text(signatureLabels[0], left, y, { width: third, align: 'center' });
    doc.text(signatureLabels[1], left + third, y, { width: third, align: 'center' });
    doc.text(signatureLabels[2], left + third * 2, y, { width: third, align: 'center' });
    doc.font('body').fontSize(8).fillColor('#888');
    doc.text('(KÃ½, ghi rÃµ há» tÃªn)', left, y + 14, { width: third, align: 'center' });
    doc.text('(KÃ½, ghi rÃµ há» tÃªn)', left + third, y + 14, { width: third, align: 'center' });
    doc.text('(KÃ½, ghi rÃµ há» tÃªn)', left + third * 2, y + 14, { width: third, align: 'center' });
    doc.fillColor('#000');
  }
}
