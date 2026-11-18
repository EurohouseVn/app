import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { QuotationPdfService } from '../src/modules/quotations/quotation-pdf.service';
import { ProjectFinancialPdfService } from '../src/modules/workshop-operations/project-financial-pdf.service';

const repoRoot = resolve(process.cwd(), '..', '..');
const outputDir = resolve(repoRoot, 'output', 'pdf');
mkdirSync(outputDir, { recursive: true });

const issuer = {
  productionName: 'XƯỞNG NHÔM KÍNH MINH PHÁT',
  mainCategories: 'Thiết kế, sản xuất và thi công cửa nhôm kính Eurohouse',
  address: '125 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh',
  phone: '0901 234 567',
  email: 'minhphat@example.vn',
  logoUrl: '../../apps/mobile/assets/logo.png',
};

const itemSeeds = [
  ['D1-01', 'Cửa đi 2 cánh mở quay', 1800, 2400, 2, 2_450_000, 'Hệ 55 Vát Cạnh', 'Trắng trong'],
  ['D1-02', 'Cửa đi 1 cánh mở quay', 900, 2200, 2, 2_380_000, 'Hệ 55 Vát Cạnh', 'Trắng trong'],
  ['D4-01', 'Cửa đi 4 cánh mở quay', 3200, 2600, 1, 2_690_000, 'Hệ Ecento Plus', 'Xanh đen'],
  ['S1-01', 'Cửa sổ 2 cánh mở quay', 1500, 1500, 4, 2_250_000, 'Hệ 55 Vát Cạnh', 'Xanh đen'],
  ['S2-01', 'Cửa sổ mở hất', 800, 1200, 3, 2_180_000, 'Hệ 55 Vát Cạnh', 'Trắng trong'],
  ['T2-01', 'Cửa trượt 2 cánh', 2400, 2200, 2, 2_320_000, 'Hệ trượt Châu Âu', 'Xanh đục'],
  ['T4-01', 'Cửa trượt 4 cánh', 4200, 2400, 1, 2_480_000, 'Hệ trượt Châu Âu', 'Trắng trong'],
  ['V1-01', 'Vách kính cố định', 1800, 2600, 3, 1_780_000, 'Hệ Preco', 'Trắng trong'],
  ['V1-02', 'Vách kính mặt tiền', 3600, 3200, 1, 2_850_000, 'Hệ mặt dựng', 'Xanh đen'],
  ['D1-03', 'Cửa đi thủy lực', 2100, 2500, 1, 3_150_000, 'Hệ thủy lực', 'Trắng trong'],
  ['S1-02', 'Cửa sổ 1 cánh', 700, 1400, 5, 2_120_000, 'Hệ Preco', 'Trắng đục'],
  ['CS-01', 'Khung chấn song bảo vệ', 1500, 1500, 4, 1_250_000, 'Hệ chấn song', 'Trắng trong'],
] as const;

const items = itemSeeds.map(([name, doorType, widthMm, heightMm, quantity, pricePerM2, system, glassColor], index) => {
  const areaM2 = Number(((widthMm * heightMm) / 1_000_000).toFixed(2));
  return {
    id: `sample-${index + 1}`, name, doorType, system, widthMm, heightMm,
    wallHugging: index === 2 ? 'Tường 200' : 'Non', quantity, pricePerM2,
    includesAccessories: true, accessoriesPrice: 0,
    color: index % 3 === 0 ? 'Màu Café Metallic' : 'Màu Xám Ngọc Trai',
    glassType: index === 8 ? 'Kính dán 8.38' : 'Kính cường lực 8mm', glassColor,
    dynamicInputs: index === 11 ? { chanSongSystem: 'Hệ chấn song', chanSongType: 'Hoa vuông' } : {},
    areaM2, totalPrice: Math.round(areaM2 * quantity * pricePerM2),
  };
});

const extraProducts = [
  { id: 'extra-1', name: 'Khóa đa điểm', description: 'Khóa đa điểm đồng bộ, tay nắm màu đen', unit: 'bộ', quantity: 6, unitPrice: 1_650_000, totalPrice: 9_900_000 },
  { id: 'extra-2', name: 'Phào trang trí', description: 'Phào viền trang trí mặt tiền', unit: 'md', quantity: 18.5, unitPrice: 420_000, totalPrice: 7_770_000 },
  { id: 'extra-3', name: 'Lưới chống muỗi', description: 'Lưới cuốn chống muỗi khung nhôm', unit: 'bộ', quantity: 5, unitPrice: 920_000, totalPrice: 4_600_000 },
];
const baseAmount = items.reduce((sum, item) => sum + item.totalPrice, 0) + extraProducts.reduce((sum, item) => sum + item.totalPrice, 0);
const vatPct = 8;
const vatAmount = Math.round((baseAmount * vatPct) / 100);
const totalAmount = baseAmount + vatAmount;
const quotation = {
  id: 'sample-quotation', code: 'BG-MP-2026-0107', customerName: 'Anh Nguyễn Minh Thành', customerPhone: '0988 456 789',
  customerAddress: 'Khu dân cư Nam Long, Quận 7, TP. Hồ Chí Minh',
  notes: 'Màu sắc thực tế được xác nhận bằng mẫu trước khi sản xuất. Kích thước được chốt lại sau khi khảo sát hiện trường.',
  createdById: 'sample-user', items, extraProducts,
  extraProductsAmount: extraProducts.reduce((sum, item) => sum + item.totalPrice, 0),
  areaM2: items.reduce((sum, item) => sum + item.areaM2 * item.quantity, 0),
  baseAmount, accessoryCost: 0, laborCost: 0, installCost: 0, depreciation: 0, profitPct: 0, profitAmount: 0,
  vatPct, vatAmount, totalAmount, isFinalSettlement: false, depositAmount: 0, remainingAmount: totalAmount,
  createdAt: new Date().toISOString(),
};

const transactions = [
  ['PT-2610-001', 'RECEIPT', 80_000_000, 'BANK_TRANSFER', 'Tạm ứng đợt 1', 'Nguyễn Minh Thành', 'Tạm ứng sau ký hợp đồng', '2026-09-10'],
  ['PC-2610-001', 'PAYMENT', 52_000_000, 'BANK_TRANSFER', 'Nhôm', 'NPP Miền Nam', 'Thanh toán vật tư nhôm đợt 1', '2026-09-12'],
  ['PC-2610-002', 'PAYMENT', 21_500_000, 'BANK_TRANSFER', 'Kính', 'Kính Thành Công', 'Kính cường lực và kính dán', '2026-09-16'],
  ['PT-2610-002', 'RECEIPT', 95_000_000, 'BANK_TRANSFER', 'Thanh toán đợt 2', 'Nguyễn Minh Thành', 'Theo tiến độ lắp đặt', '2026-09-25'],
  ['PC-2610-003', 'PAYMENT', 18_900_000, 'CASH', 'Phụ kiện', 'Phụ kiện Hưng Thịnh', 'Khóa, bản lề và tay nắm', '2026-09-27'],
  ['PC-2610-004', 'PAYMENT', 12_500_000, 'CASH', 'Nhân công', 'Đội thi công số 1', 'Tạm ứng nhân công lắp đặt', '2026-10-01'],
  ['PT-2610-003', 'RECEIPT', 70_000_000, 'BANK_TRANSFER', 'Thanh toán đợt 3', 'Nguyễn Minh Thành', 'Thanh toán sau nghiệm thu', '2026-10-05'],
  ['PC-2610-005', 'PAYMENT', 4_800_000, 'CASH', 'Vận chuyển', 'Đơn vị vận tải', 'Vận chuyển và nâng hàng', '2026-10-06'],
].map(([code, type, amount, method, category, partnerName, note, transDate]) => ({
  code: String(code), type: String(type), amount: Number(amount), method: String(method), category: String(category),
  partnerName: String(partnerName), note: String(note), transDate: String(transDate),
}));

const financialReport = {
  code: 'CT-MP-2026-018', name: 'Biệt thự anh Thành - KDC Nam Long', customerName: 'Anh Nguyễn Minh Thành',
  customerPhone: '0988 456 789', address: 'Khu dân cư Nam Long, Quận 7, TP. Hồ Chí Minh', status: 'IN_PROGRESS',
  quotationId: quotation.code, contractValue: totalAmount, estimatedValue: totalAmount, incurredValue: 12_500_000,
  incurredType: 'INCREASE', settledValue: totalAmount + 12_500_000, extraRevenue: 4_800_000,
  costAluminum: 84_600_000, costAccessory: 22_800_000, costLockHinge: 11_400_000, costGlass: 31_500_000,
  costGasket: 3_250_000, costSilicone: 2_180_000, costScrew: 1_420_000, costLabor: 18_500_000,
  costConsumables: 2_600_000, costTransport: 4_800_000, costInstallation: 13_200_000, costPartnerPct: 2, costOther: 3_000_000,
  note: 'Báo cáo dùng để đối chiếu nội bộ trước khi lập quyết toán cuối cùng với khách hàng.',
  createdAt: '2026-09-08', updatedAt: new Date().toISOString(),
  customCosts: [
    { category: 'EQUIPMENT', label: 'Thuê giàn giáo', amount: 3_600_000, note: 'Giàn giáo và thiết bị nâng' },
    { category: 'SITE', label: 'Chi phí công trường', amount: 1_850_000, note: 'Điện, nước và bảo vệ' },
  ],
  transactions, issuer,
};

async function main() {
  const quotationPdf = new QuotationPdfService();
  const financialPdf = new ProjectFinancialPdfService();
  const [quoteBuffer, estimateBuffer, financialBuffer] = await Promise.all([
    quotationPdf.render(quotation as any, issuer, 'quotation'),
    quotationPdf.render(quotation as any, issuer, 'estimate'),
    financialPdf.render(financialReport),
  ]);
  const files = [
    ['EUROHOUSE_BaoGia_Mau.pdf', quoteBuffer],
    ['EUROHOUSE_DuToan_Mau.pdf', estimateBuffer],
    ['EUROHOUSE_TongHopThuChi_Mau.pdf', financialBuffer],
  ] as const;
  for (const [name, buffer] of files) writeFileSync(resolve(outputDir, name), buffer);
  console.log(JSON.stringify({ outputDir, files: files.map(([name, buffer]) => ({ name, bytes: buffer.length })) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
