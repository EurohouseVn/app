import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

export const PDF_COLORS = {
  ink: '#172033',
  text: '#344054',
  muted: '#667085',
  line: '#D0D5DD',
  soft: '#F7F8FA',
  orange: '#F97316',
  orangeSoft: '#FFF2E8',
  green: '#047857',
  red: '#B42318',
  white: '#FFFFFF',
};

export interface PdfIssuerProfile {
  name?: string;
  productionName?: string;
  address?: string;
  phone?: string;
  email?: string;
  fanpage?: string;
  mainCategories?: string;
  logoUrl?: string;
}

export function registerPdfFonts(doc: PDFKit.PDFDocument) {
  const fontDir = join(process.cwd(), 'assets', 'fonts');
  doc.registerFont('body', join(fontDir, 'NotoSans-Regular.ttf'));
  doc.registerFont('bold', join(fontDir, 'NotoSans-Bold.ttf'));
}

export function formatMoney(value: number): string {
  return `${Math.round(Number(value) || 0).toLocaleString('vi-VN')} đ`;
}

export function formatDecimal(value: number, digits = 2): string {
  return (Number(value) || 0).toLocaleString('vi-VN', { maximumFractionDigits: digits });
}

export function formatPdfDate(value: Date | string): string {
  return new Date(value).toLocaleDateString('vi-VN');
}

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const GROUPS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readThreeDigits(value: number, full: boolean): string {
  const hundred = Math.floor(value / 100);
  const ten = Math.floor((value % 100) / 10);
  const unit = value % 10;
  const words: string[] = [];

  if (hundred > 0 || full) words.push(`${DIGITS[hundred]} trăm`);
  if (ten > 1) {
    words.push(`${DIGITS[ten]} mươi`);
    if (unit === 1) words.push('mốt');
    else if (unit === 4) words.push('tư');
    else if (unit === 5) words.push('lăm');
    else if (unit > 0) words.push(DIGITS[unit]);
  } else if (ten === 1) {
    words.push('mười');
    if (unit === 5) words.push('lăm');
    else if (unit > 0) words.push(DIGITS[unit]);
  } else if (unit > 0) {
    if (hundred > 0 || full) words.push('lẻ');
    words.push(DIGITS[unit]);
  }
  return words.join(' ');
}

export function moneyInWords(input: number): string {
  const value = Math.max(0, Math.round(Number(input) || 0));
  if (value === 0) return 'Không đồng';
  const groups: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (!group) continue;
    const hasHigherGroup = words.length > 0;
    words.push(readThreeDigits(group, hasHigherGroup && group < 100));
    if (GROUPS[index]) words.push(GROUPS[index]);
  }
  const result = words.join(' ').replace(/\s+/g, ' ').trim();
  return `${result.charAt(0).toUpperCase()}${result.slice(1)} đồng`;
}

export async function loadPdfLogo(profile?: PdfIssuerProfile): Promise<Buffer | null> {
  const logoUrl = profile?.logoUrl?.trim();
  if (!logoUrl) return null;
  try {
    if (/^https?:\/\//i.test(logoUrl)) {
      const response = await axios.get<ArrayBuffer>(logoUrl, { responseType: 'arraybuffer', timeout: 8_000 });
      return Buffer.from(response.data);
    }
    const cleanPath = logoUrl.replace(/^\/static\//, 'public/').replace(/^\//, '');
    const candidates = [
      join(process.cwd(), cleanPath),
      join(process.cwd(), 'public', 'images', 'logos', logoUrl.split('/').pop() || ''),
    ];
    const path = candidates.find(existsSync);
    return path ? readFileSync(path) : null;
  } catch {
    return null;
  }
}

export function addPdfPageFooters(doc: PDFKit.PDFDocument, documentCode: string, issuerName = 'EUROHOUSE Workshop OS') {
  const range = doc.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const y = doc.page.height - doc.page.margins.bottom - 12;
    doc.moveTo(left, y - 6).lineTo(left + width, y - 6).lineWidth(0.5).strokeColor(PDF_COLORS.line).stroke();
    doc.font('body').fontSize(7.5).fillColor(PDF_COLORS.muted)
      .text(`${issuerName} | ${documentCode}`, left, y, { width: width * 0.72, lineBreak: false, ellipsis: true });
    doc.text(`Trang ${pageIndex - range.start + 1}/${range.count}`, left, y, { width, align: 'right', lineBreak: false });
  }
}
