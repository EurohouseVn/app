import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const PROFILES_DIR = path.join(__dirname, '..', 'public', 'profiles');

// Mật khẩu chung cho tài khoản demo (băm bằng bcrypt khi seed)
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Eurohouse@2026';

// 8/11 hệ nhôm đã có đủ ảnh + mã chuẩn (gom nhóm từ phiếu xuất kho + catalog R17).
// Còn 3 hệ (Ecento Plus, Phào đại hội, Mặt dựng) đang chờ cắt lại ảnh nguồn — xem
// tools/profile-crop/out/{ecento-plus,phao-dai-hoi,mat-dung}/ (segment.mjs cắt sai số ô).
const aluSystems = [
  { code: 'EU-55', name: 'Hệ 55 mở quay', description: 'Cửa đi & cửa sổ mở quay hệ 55', sortOrder: 1 },
  { code: 'EU-PRECO', name: 'Hệ Preco', description: 'Hệ cửa đi & cửa sổ dòng Preco', sortOrder: 2 },
  { code: 'EU-TRUOT', name: 'Hệ trượt Xingfa', description: 'Cửa trượt lùa, trượt quay kiểu châu Âu', sortOrder: 3 },
  { code: 'EU-TQ', name: 'Hệ trượt quay', description: 'Cửa trượt quay đa điểm', sortOrder: 4 },
  { code: 'EU-70', name: 'Hệ 70 Ecento', description: 'Cửa đi & cửa sổ hệ 70', sortOrder: 5 },
  { code: 'EU-TL', name: 'Hệ thủy lực', description: 'Khung thủy lực, mặt dựng', sortOrder: 6 },
  { code: 'EU-NOITHAT', name: 'Hệ nội thất', description: 'Phào, nẹp nội thất trang trí', sortOrder: 7 },
  { code: 'EU-CS', name: 'Hệ chấn song', description: 'Chấn song bảo vệ, trang trí', sortOrder: 8 },
  // 3 hệ dưới đây CHƯA có ảnh mặt cắt thật (segment.mjs cắt sai số ô khi phân
  // đoạn PDF catalog — xem tools/profile-crop/out/{ecento-plus,phao-dai-hoi,mat-dung}/).
  // Mã + tên lấy từ tools/profile-crop/batch-all.mjs, imageUrl để trống (ProfileImage hiện "N/A").
  { code: 'EU-ECPLUS', name: 'Hệ Ecento Plus', description: 'Cửa đi & cửa sổ dòng Ecento Plus (chưa có ảnh mặt cắt)', sortOrder: 9 },
  { code: 'EU-PDH', name: 'Hệ phào đại hội', description: 'Phào trang trí đại hội (chưa có ảnh mặt cắt)', sortOrder: 10 },
  { code: 'EU-MD', name: 'Hệ mặt dựng', description: 'Mặt dựng nhôm kính (chưa có ảnh mặt cắt)', sortOrder: 11 },
];

// 6 màu sơn tĩnh điện chuẩn Eurohouse
const colors = [
  { code: 'CAM-LAI', name: 'Gỗ Cẩm Lai', hex: '#5A3320' },
  { code: 'XAM-NGOC-TRAI', name: 'Xám Ngọc Trai', hex: '#C7CBD0' },
  { code: 'CAFE-METALIC', name: 'Cafe Metalic', hex: '#4A3A2E' },
  { code: 'XAM-RITA', name: 'Xám Rita', hex: '#6C7176' },
  { code: 'OLAK', name: 'Vân gỗ Olak', hex: '#8A5A2B' },
  { code: 'CAFE-THUONG', name: 'Cafe Thường', hex: '#3A2B20' },
];

// 129 thanh nhôm thật từ "pxk mẫu.xlsx" (đối chiếu ảnh cắt tại tools/profile-crop/out/):
// [hệ, mã cây, tên, tỉ trọng kg/m, quy cách cây/bó]
const profiles: [string, string, string, number, number][] = [
  // == EU-55 - Hệ 55 mở quay ==
  ['EU-55', 'DAK55', 'Khung cửa đi và cửa sổ', 0.804, 4],
  ['EU-55', 'LH5110', 'Khung cửa đi và cửa sổ hệ 55 VIP', 1.368, 2],
  ['EU-55', 'KHK65', 'Khung phào mở quay ngoài', 1.12, 2],
  ['EU-55', 'LH11801', 'Cánh cửa đi bản rộng', 1.369, 2],
  ['EU-55', 'DAD91', 'Cánh cửa đi', 1.098, 4],
  ['EU-55', 'DAS76', 'Cánh cửa sổ', 0.901, 4],
  ['EU-55', 'DATD76', 'Đố cánh', 0.997, 4],
  ['EU-55', 'DAT55', 'Đố khung', 0.941, 4],
  ['EU-55', 'PR-DD55', 'Khung phào mở quay ngoài (DD)', 0.94, 4],
  ['EU-55', 'DAS14', 'Nẹp vách', 0.217, 10],
  ['EU-55', 'DA3002', 'Pano', 0.484, 10],
  ['EU-55', 'C3326', 'Chuyển góc 90 độ', 1.051, 4],
  ['EU-55', 'CN55', 'Sập chân cánh', 0.233, 10],
  ['EU-55', 'C3300', 'Xập ghép khung', 0.348, 10],
  ['EU-55', 'E192', 'Lá chớp', 0.317, 10],
  ['EU-55', 'E1283A', 'Khung chớp', 0.29, 10],
  ['EU-55', 'PR2990', 'Cánh cửa trượt 90', 0.954, 4],
  ['EU-55', 'PR55M90', 'Nẹp móc cửa trượt', 0.341, 10],
  ['EU-55', 'PR5512', 'Ray mỏng cửa lùa', 0.552, 5],
  ['EU-55', 'PR5542', 'Khung cửa trượt', 0.78, 4],
  ['EU-55', 'PR2966', 'Cánh cửa trượt', 0.681, 4],
  ['EU-55', 'PR55N', 'Nẹp sập cửa bốn cánh', 0.258, 10],
  ['EU-55', 'PR55M', 'Nẹp móc cửa trượt', 0.341, 10],
  // == EU-PRECO - Hệ Preco ==
  ['EU-PRECO', 'RPK50', 'Khung cửa đi và cửa sổ Preco 50', 0.664, 4],
  ['EU-PRECO', 'PRD91', 'Cánh cửa đi', 0.8645, 4],
  ['EU-PRECO', 'PRS76', 'Cánh cửa sổ', 0.744, 4],
  ['EU-PRECO', 'C3300', 'Xập ghép khung', 0.348, 10],
  ['EU-PRECO', 'DAT55', 'Đố khung', 0.941, 4],
  ['EU-PRECO', 'DATD76', 'Đố cánh', 0.997, 4],
  ['EU-PRECO', 'PR-DD55', 'Khung phào mở quay ngoài (DD)', 0.94, 4],
  ['EU-PRECO', 'DA3002', 'Pano', 0.484, 10],
  ['EU-PRECO', 'DAS14', 'Nẹp vách', 0.217, 10],
  ['EU-PRECO', 'C3300-2', 'Xập ghép khung (biến thể Preco)', 0.348, 10],
  ['EU-PRECO', 'CN55', 'Sập chân cánh', 0.233, 10],
  ['EU-PRECO', 'C3326', 'Chuyển góc 90 độ', 1.051, 4],
  // == EU-TRUOT - Hệ trượt Xingfa (gộp trượt mở + trượt châu Âu) ==
  ['EU-TRUOT', 'PR5542', 'Khung cửa trượt', 0.78, 4],
  ['EU-TRUOT', 'PR2966', 'Cánh cửa trượt', 0.681, 4],
  ['EU-TRUOT', 'PR55N', 'Nẹp sập cửa bốn cánh', 0.258, 10],
  ['EU-TRUOT', 'PR55M', 'Nẹp móc cửa trượt', 0.341, 10],
  ['EU-TRUOT', 'KH-T9801', 'Cánh trượt', 1.3991, 2],
  ['EU-TRUOT', 'KH-T9802', 'Khung trượt', 1.3991, 2],
  ['EU-TRUOT', 'KH-T9803', 'Ray dưới', 0.7135, 4],
  ['EU-TRUOT', 'KH-T9804', 'Khung đơn', 0.6535, 4],
  ['EU-TRUOT', 'KH-T9805', 'Ray đơn', 0.4396, 6],
  ['EU-TRUOT', 'KH-T9806', 'Sập đối đầu', 0.2785, 10],
  ['EU-TRUOT', 'KH-T9807', 'Sập U', 0.1956, 10],
  ['EU-TRUOT', 'KH-T9808', 'Nẹp móc liền tay nắm', 1.0309, 2],
  ['EU-TRUOT', 'KH-K9809', 'Sập kính hộp', 0.214, 10],
  ['EU-TRUOT', 'KH-K9810', 'Nẹp kính hộp', 0.1799, 20],
  ['EU-TRUOT', 'KH-K9812', 'Nẹp đối đầu 90 độ cửa trượt', 0.487, 10],
  ['EU-TRUOT', 'KH-T9813', 'Nẹp móc', 0.47, 10],
  ['EU-TRUOT', 'KH-T9814', 'Nẹp phụ kiện cửa trượt châu Âu', 0.47, 10],
  // == EU-NOITHAT - Hệ nội thất ==
  ['EU-NOITHAT', 'KH01', 'Phào nóc', 0.7204, 4],
  ['EU-NOITHAT', 'KH17', 'Cánh nhỏ', 0.502, 5],
  ['EU-NOITHAT', 'KH03', 'Pano phẳng 16', 0.7548, 5],
  ['EU-NOITHAT', 'KH04', 'Cột sau', 0.3121, 5],
  ['EU-NOITHAT', 'KH05', 'Khung vách', 0.3508, 5],
  ['EU-NOITHAT', 'KH06', 'Cột trước', 0.8165, 4],
  ['EU-NOITHAT', 'KH07', 'Đố chia vách', 0.2189, 10],
  ['EU-NOITHAT', 'KH08', 'Lá chớp', 0.4218, 5],
  ['EU-NOITHAT', 'KH09', 'U16', 0.1302, 10],
  ['EU-NOITHAT', 'KH10', 'Thanh ngang', 0.4974, 5],
  ['EU-NOITHAT', 'KH11', 'Cây ngăn kéo', 0.2051, 10],
  ['EU-NOITHAT', 'KH12', 'Phào nhỏ', 0.3034, 10],
  ['EU-NOITHAT', 'KH13', 'Cột trước nhỏ', 0.4841, 5],
  ['EU-NOITHAT', 'KH14', 'U8', 0.146, 10],
  ['EU-NOITHAT', 'KH15', 'Thanh phào trang trí nội thất', 0.25, 10],
  ['EU-NOITHAT', 'KH16', 'Nan trang trí', 0.258, 20],
  // == EU-TQ - Hệ trượt quay ==
  ['EU-TQ', 'KH-TQ01', 'Ray khung', 1.058, 2],
  ['EU-TQ', 'KH-TQ02', 'Ray cánh', 1.5074, 2],
  ['EU-TQ', 'KH-TQ03', 'Khung 6m', 1.7177, 2],
  ['EU-TQ', 'KH-TQ04', 'Cánh trên', 1.4217, 2],
  ['EU-TQ', 'KH-TQ05', 'Cánh đứng móc', 1.3847, 2],
  ['EU-TQ', 'KH-TQ06', 'Cánh bản lề', 1.6214, 2],
  ['EU-TQ', 'KH-TQ07', 'Cánh dưới', 1.2295, 2],
  ['EU-TQ', 'KH-TQ08', 'Cánh đứng ngoài', 1.6754, 2],
  ['EU-TQ', 'KH-TQ09', 'Sập nối cánh', 0.3205, 10],
  ['EU-TQ', 'KH-TQ10', 'Nẹp che phụ kiện', 0.092, 20],
  // == EU-70 - Hệ 70 Ecento ==
  ['EU-70', 'E701A', 'Khung liền phào', 1.385, 2],
  ['EU-70', 'E70D110', 'Cánh cửa đi 110', 1.963, 2],
  ['EU-70', 'E70S86', 'Cánh cửa sổ E70', 1.515, 2],
  ['EU-70', 'E70SH', 'Sập kính thường', 0.266, 10],
  ['EU-70', 'T9809', 'Sập kính hộp', 0.214, 10],
  ['EU-70', 'E70KD', 'Khung đơn', 1.214, 4],
  ['EU-70', 'E704A', 'Đố chia khung (biến thể A)', 1.188, 4],
  ['EU-70', 'C3296', 'Sập kính', 0.237, 10],
  ['EU-70', 'C3225', 'Sập kính hộp', 0.211, 10],
  ['EU-70', 'E70T98', 'Đố khung', 1.498, 2],
  ['EU-70', 'E70D190', 'Cánh 190', 2.91, 1],
  ['EU-70', 'E70D150', 'Cánh 150', 2.393, 1],
  ['EU-70', 'KTL-04', 'Nẹp kính tròn', 0.364, 10],
  ['EU-70', 'KTL-07', 'Nẹp kính vuông', 0.364, 10],
  ['EU-70', 'KTL-03', 'Nẹp kính hộp', 0.23, 10],
  ['EU-70', 'E70NK', 'Nối khung', 0.373, 10],
  ['EU-70', 'E705', 'Đố động', 1.045, 4],
  ['EU-70', 'E706', 'Nẹp chân cánh', 0.34, 10],
  ['EU-70', 'E702', 'Nẹp phẳng', 0.096, 10],
  ['EU-70', 'E70KT', 'Khung thấp E70', 0.72, 5],
  // == EU-TL - Hệ thủy lực ==
  ['EU-TL', 'KTL-01', 'Cánh 180', 3.06, 1],
  ['EU-TL', 'KTL-05', 'Khung 200', 2.9, 1],
  ['EU-TL', 'KTL-03', 'Nẹp kính hộp', 0.23, 10],
  ['EU-TL', 'KTL-04', 'Nẹp kính tròn', 0.364, 10],
  ['EU-TL', 'KTL08', 'Sập cánh kính hộp vuông', 0.301, 10],
  ['EU-TL', 'KTL-06', 'Đế sập', 0.377, 10],
  ['EU-TL', 'KTL-07', 'Nẹp kính vuông', 0.364, 10],
  ['EU-TL', 'KTL09', 'Đế sập kính hộp', 0.417, 10],
  ['EU-TL', 'D1409', 'Sập vách kính hộp', 0.377, 10],
  ['EU-TL', 'C101', 'Sập vách kính', 0.133, 10],
  // == EU-CS - Hệ chấn song ==
  ['EU-CS', 'ECS01', 'Khung chấn song hệ 55', 1.391, 2],
  ['EU-CS', 'ECS02', 'Khung chấn song hệ E70', 1.463, 2],
  ['EU-CS', 'ECS03', 'Nối khung chấn song', 1.275, 2],
  ['EU-CS', 'ECS04', 'Phào rời chấn song', 0.374, 10],
  ['EU-CS', 'ECS05', 'Chấn song D28', 0.424, 5],
  ['EU-CS', 'ECS06', 'Thanh liên kết', 0.279, 10],
  ['EU-CS', 'ECS07', 'Thanh ngang xương', 0.581, 5],
  ['EU-CS', 'ECS08', 'Nắp bịt khung', 0.125, 10],
  ['EU-CS', 'ECS09', 'Nối phào', 0.233, 10],
  ['EU-CS', 'ECS10', 'Phào dài', 0.458, 10],
  ['EU-CS', 'ECS11', 'Nối khung 3cm', 0.46, 10],
  ['EU-CS', 'ECS12', 'Song lục giác', 0.537, 5],
  ['EU-CS', 'ECS13', 'Thanh ngang xương 75mm', 0.756, 4],
  ['EU-CS', 'ECS14', 'Phào 55mm', 0.494, 10],
  ['EU-CS', 'ECS15', 'Chấn song chữ nhật', 0.409, 5],
  ['EU-CS', 'ECS17', 'Hộp 25x120', 1.2, 2],
  ['EU-CS', '50X150', 'Hộp chấn song 50x150', 1.6, 1],
  ['EU-CS', 'ECS18', 'Phào cân', 0.344, 10],
  ['EU-CS', 'ECS20-30X150', 'Hộp chấn song 30x150', 1.1, 1],
  ['EU-CS', 'ECS22-P75', 'Chấn song tròn phi 75', 0.8, 5],
  ['EU-CS', 'ECS21-P100', 'Chấn song tròn phi 100', 1.0, 5],
];

// 37 mã thuộc 3 hệ CHƯA có ảnh mặt cắt (xem chú thích ở aluSystems phía trên).
// Mã/tên/kg lấy từ batch-all.mjs + đối chiếu "pxk mẫu.xlsx"; vài mã không có trong
// phiếu xuất kho (đánh dấu *) dùng giá trị suy luận từ mã liền kề cùng nhóm.
const profilesNoImage: [string, string, string, number, number][] = [
  // == EU-ECPLUS - Hệ Ecento Plus ==
  ['EU-ECPLUS', 'C3328P', 'Khung bao liền phào', 1.25, 2],
  ['EU-ECPLUS', 'C3328-1.4', 'Khung bao cửa đi', 1.257, 4],
  ['EU-ECPLUS', 'EPK116', 'Khung chấn song 116 *', 1.5, 2],
  ['EU-ECPLUS', 'EPD98', 'Cánh cửa đi', 1.469, 2],
  ['EU-ECPLUS', 'EPS78', 'Cánh cửa sổ', 1.127, 2],
  ['EU-ECPLUS', 'EPTD80', 'Đố cánh', 1.008, 2],
  ['EU-ECPLUS', 'C3323-ND', 'Đố động (biến thể ND) *', 1.08, 4],
  ['EU-ECPLUS', 'C3313', 'Đố khung', 0.899, 4],
  ['EU-ECPLUS', 'C3329A', 'Ốp chân cánh', 0.458, 10],
  ['EU-ECPLUS', 'C3296', 'Sập kính', 0.237, 10],
  ['EU-ECPLUS', 'EPS78S', 'Cánh cửa sổ (biến thể S)', 1.127, 4],
  ['EU-ECPLUS', 'EPD98S', 'Cánh cửa đi (biến thể S)', 1.469, 2],
  ['EU-ECPLUS', 'E70SH', 'Sập kính thường', 0.266, 10],
  ['EU-ECPLUS', 'T9809', 'Sập kính hộp', 0.214, 10],
  ['EU-ECPLUS', 'EPD138', 'Cánh cửa đi 138', 1.817, 1],
  ['EU-ECPLUS', 'EPD125P', 'Cánh cửa đi 125 (liền phào) *', 1.6, 2],
  ['EU-ECPLUS', 'EPS20-125', 'Sập kính hộp 125', 0.35, 10],
  ['EU-ECPLUS', 'EPS12-125', 'Sập kính thường 125', 0.35, 10],
  ['EU-ECPLUS', 'EPD138P', 'Cánh cửa đi 138 (liền phào) *', 1.9, 1],
  ['EU-ECPLUS', 'EPSV11', 'Sập vách kính hộp *', 0.3, 10],
  // == EU-PDH - Hệ phào đại hội ==
  ['EU-PDH', 'DH01', 'Khung chính (Phào đại PĐ01)', 1.423, 1],
  ['EU-PDH', 'DH02', 'Cột phụ (Phào đại PĐ02)', 0.361, 10],
  ['EU-PDH', 'DH03', 'Đế ốp (Phào đại PĐ03)', 0.228, 10],
  ['EU-PDH', 'DH04', 'Phào đại PĐ04 *', 0.3, 10],
  ['EU-PDH', 'DH05', 'Phào đại PĐ05 *', 0.3, 10],
  ['EU-PDH', 'KH01CT', 'Phào đỉnh', 0.69, 4],
  ['EU-PDH', 'EPV01', 'Phào nối đỉnh', 0.348, 10],
  ['EU-PDH', 'ECS21-P100', 'Chấn song tròn phi 100', 1.0, 5],
  ['EU-PDH', 'KH10', 'Thanh ngang', 0.497, 5],
  ['EU-PDH', 'ECS18', 'Phào cân', 0.344, 10],
  ['EU-PDH', 'ECS18-2', 'Phào cân (biến thể 2) *', 0.344, 10],
  ['EU-PDH', 'KH09', 'U16', 0.130, 10],
  // == EU-MD - Hệ mặt dựng ==
  ['EU-MD', 'EMD6577', 'Mặt dựng 65x77', 1.615, 2],
  ['EU-MD', 'EMD65100', 'Mặt dựng 65x100', 2.245, 2],
  ['EU-MD', 'EMD65120', 'Mặt dựng 65x120 *', 2.6, 2],
  ['EU-MD', 'EMDK46', 'Khung mặt dựng 46', 0.75, 5],
  ['EU-MD', 'EMDS38', 'Sập mặt dựng 38 *', 0.2, 10],
];

async function main() {
  const company = await prisma.organization.upsert({
    where: { code: 'EUROHOUSE' }, update: {},
    create: { code: 'EUROHOUSE', name: 'Công ty Eurohouse', type: 'COMPANY', phone: '0221 3900 899', address: 'Hưng Yên' },
  });
  const factory = await prisma.organization.upsert({
    where: { code: 'XUONG-01' }, update: {},
    create: { code: 'XUONG-01', name: 'Xưởng sản xuất 01', type: 'FACTORY', phone: '0901 111 222', address: 'Bình Tân, TP.HCM' },
  });
  const npp = await prisma.organization.upsert({
    where: { code: 'NPP-01' }, update: {},
    create: { code: 'NPP-01', name: 'NPP Miền Nam', type: 'NPP', phone: '0902 333 444', address: 'An Phú, TP.HCM' },
  });
  // Gán Xưởng 01 cho NPP Miền Nam quản lý — đơn Thợ đặt sẽ tự động chuyển về NPP này.
  await prisma.organization.update({
    where: { id: factory.id }, data: { managedByNppId: npp.id },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: 'tho@eurohouse.vn' }, update: { passwordHash },
    create: { email: 'tho@eurohouse.vn', displayName: 'Thợ / Xưởng', passwordHash, role: 'FACTORY', organizationId: factory.id },
  });
  await prisma.user.upsert({
    where: { email: 'board@eurohouse.vn' }, update: { passwordHash },
    create: { email: 'board@eurohouse.vn', displayName: 'Quản trị Eurohouse', passwordHash, role: 'ADMIN', organizationId: company.id },
  });
  await prisma.user.upsert({
    where: { email: 'npp@eurohouse.vn' }, update: { passwordHash },
    create: { email: 'npp@eurohouse.vn', displayName: 'NPP Miền Nam', passwordHash, role: 'NPP', organizationId: npp.id },
  });

  // Xoá màu cũ, nạp 6 màu chuẩn
  await prisma.colorCode.deleteMany();
  for (const color of colors) {
    await prisma.colorCode.create({ data: color });
  }

  const systemIdByCode: Record<string, string> = {};
  for (const sys of aluSystems) {
    const created = await prisma.aluSystem.upsert({
      where: { code: sys.code },
      update: { name: sys.name, description: sys.description, sortOrder: sys.sortOrder },
      create: sys,
    });
    systemIdByCode[sys.code] = created.id;
  }

  // Xoá profile cũ, nạp toàn bộ thanh nhôm (129 có ảnh + 37 chưa có ảnh)
  await prisma.orderItem.deleteMany();
  await prisma.profile.deleteMany();
  for (const [sys, code, name, kg, bundle] of [...profiles, ...profilesNoImage]) {
    const hasImage = fs.existsSync(path.join(PROFILES_DIR, `${code}.png`));
    await prisma.profile.create({
      data: {
        aluSystemId: systemIdByCode[sys], code, name, kgPerMeter: kg,
        barLengthMm: 6000, barsPerBundle: bundle, pricePerKg: 92000,
        imageUrl: hasImage ? `/static/profiles/${code}.png` : null,
      },
    });
  }

  // Khuyến mãi Hè 2026
  const promoCount = await prisma.promotion.count();
  if (promoCount === 0) {
    await prisma.promotion.create({
      data: {
        title: 'Khuyến mãi Hè 2026', subtitle: 'Áp dụng từ tháng 6 đến tháng 8',
        imageUrl: '/static/promo/Khuyen_mai_t6_0.jpg', bannerUrl: '/static/promo/Khuyen_mai_t6_0.jpg',
        gallery: JSON.stringify([
          '/static/promo/Khuyen_mai_t6_0.jpg',
          '/static/promo/Khuyen_mai_t6_1.jpg',
          '/static/promo/Khuyen_mai_t6_2.jpg',
          '/static/promo/Khuyen_mai_t6_3.jpg',
        ]),
        content: 'Chương trình tích điểm và quà tặng cho thợ, đại lý và NPP trong suốt mùa hè 2026. Mỗi đơn hàng và mỗi lượt kích hoạt bảo hành đều được cộng điểm đổi quà.',
        active: true, sortOrder: 1,
        startDate: new Date('2026-06-01'), endDate: new Date('2026-08-31'),
      },
    });
  }

  if ((await prisma.gift.count()) === 0) {
    const gifts = [
      { name: 'Bộ dụng cụ cầm tay', points: 800, icon: 'tool', stock: 20 },
      { name: 'Máy khoan pin', points: 1500, icon: 'tool', stock: 12 },
      { name: 'Điện thoại', points: 5000, icon: 'smartphone', stock: 5 },
      { name: 'Balo Eurohouse', points: 600, icon: 'shopping-bag', stock: 40 },
    ];
    for (const gift of gifts) await prisma.gift.create({ data: gift });
  }

  if ((await prisma.libraryItem.count()) === 0) {
    const library = [
      { type: 'IMAGE', title: 'Cửa đi 4 cánh mặt tiền', tag: 'Cửa đi' },
      { type: 'IMAGE', title: 'Cửa sổ mở quay vân gỗ', tag: 'Cửa sổ' },
      { type: 'KNOWLEDGE', title: 'Hướng dẫn đo đạc lắp đặt', tag: 'Kỹ thuật' },
      { type: 'VIDEO', title: 'Quy trình sản xuất Eurohouse', tag: 'Video', videoUrl: 'https://www.youtube.com/@eurohouse' },
    ];
    for (const item of library) await prisma.libraryItem.create({ data: item });
  }

  // 11 nhóm NVL/chi phí sản xuất: 6 vật liệu trực tiếp + 5 chi phí sản xuất chung
  if ((await prisma.material.count()) === 0) {
    const materials = [
      { code: 'BILLET', name: 'Billet nhôm', category: 'DIRECT_MATERIAL', group: 'BILLET', unit: 'kg', unitPrice: 62000, stockQty: 5000, lowStockAlert: 1000 },
      { code: 'SON-TD', name: 'Sơn tĩnh điện', category: 'DIRECT_MATERIAL', group: 'PAINT', unit: 'kg', unitPrice: 85000, stockQty: 300, lowStockAlert: 50 },
      { code: 'TEM-NHAN', name: 'Tem nhãn sản phẩm', category: 'DIRECT_MATERIAL', group: 'LABEL', unit: 'cuộn', unitPrice: 120000, stockQty: 40, lowStockAlert: 10 },
      { code: 'NILONG', name: 'Nilong bọc', category: 'DIRECT_MATERIAL', group: 'NYLON', unit: 'cuộn', unitPrice: 35000, stockQty: 60, lowStockAlert: 15 },
      { code: 'BAOBI', name: 'Bao bì / thùng carton', category: 'DIRECT_MATERIAL', group: 'PACKAGING', unit: 'thùng', unitPrice: 15000, stockQty: 500, lowStockAlert: 100 },
      { code: 'PHUKIEN', name: 'Phụ kiện (bản lề/khóa/kính)', category: 'DIRECT_MATERIAL', group: 'ACCESSORY_HW', unit: 'bộ', unitPrice: 22000, stockQty: 150, lowStockAlert: 30 },
      { code: 'DIEN-SX', name: 'Điện sản xuất', category: 'OVERHEAD', group: 'ELECTRICITY', unit: 'kWh', unitPrice: 3200, stockQty: 0, lowStockAlert: 0 },
      { code: 'GAS-LPG', name: 'Gas / LPG', category: 'OVERHEAD', group: 'GAS', unit: 'kg', unitPrice: 28000, stockQty: 200, lowStockAlert: 50 },
      { code: 'NUOC', name: 'Nước', category: 'OVERHEAD', group: 'WATER', unit: 'm3', unitPrice: 15000, stockQty: 0, lowStockAlert: 0 },
      { code: 'DAU-DO', name: 'Nhiên liệu máy (dầu DO)', category: 'OVERHEAD', group: 'FUEL', unit: 'lít', unitPrice: 22000, stockQty: 300, lowStockAlert: 50 },
      { code: 'BAOTRI', name: 'Bảo trì thiết bị', category: 'OVERHEAD', group: 'MAINTENANCE', unit: 'lần', unitPrice: 0, stockQty: 0, lowStockAlert: 0 },
    ];
    for (const material of materials) await prisma.material.create({ data: material });
  }

  if ((await prisma.debt.count()) === 0) {
    await prisma.debt.create({
      data: { type: 'CUSTOMER', direction: 'RECEIVABLE', partnerName: 'Khách lẻ Nguyễn Văn A', amount: 25000000, paidAmount: 10000000, status: 'PARTIAL', note: 'Công trình biệt thự Q9' },
    });
    await prisma.debt.create({
      data: { type: 'ACCESSORY', direction: 'PAYABLE', partnerName: 'NCC Billet Miền Bắc', amount: 180000000, paidAmount: 0, status: 'OPEN', bankName: 'Vietcombank', bankAccount: '0071000123456', note: 'Nhập billet tháng 6/2026' },
    });
  }

  console.log(`Seed xong: ${aluSystems.length} hệ nhôm, ${profiles.length + profilesNoImage.length} thanh nhôm, ${colors.length} màu.`);
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
