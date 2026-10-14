const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const WRITE_SNAPSHOT = process.argv.includes('--write-snapshot');
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const WORKBOOK_PATH = path.join(WORKSPACE_ROOT, 'Đơn đặt hàng (Recovered).xlsx');
const PDF_PATH = path.join(WORKSPACE_ROOT, 'EUROHOUSE CATALOG R19 021026-PRINT (18PAGE)-đã nén.pdf');
const EXPECTED_WORKBOOK_HASH = 'E8C3BA878026104C30E87A8F6713F284446D4A152B37D17E4A4CE4B4B507848D';
const EXPECTED_PDF_HASH = '2F2395F6E4A9383D8000AC643F50DB3BB90E2944899448D015F850AC6406D979';

const SHEET_TO_SYSTEM = {
  'HỆ_55': 'EU-55',
  PRECO: 'EU-PRECO',
  'NỘI_THẤT': 'EU-NOITHAT',
  'THỦY_LỰC_': 'EU-TL',
  'CHẤN_SONG_': 'EU-CS',
  PLUS: 'EU-ECPLUS',
  'ĐẠI_HỘI': 'EU-PDH',
  ECENTO_E70: 'EU-70',
  'TRƯỢT_QUAY': 'EU-TQ',
  'TRƯỢT_': 'EU-TRUOT',
};

const EXCLUDED_SHEETS = {
  'ITARICO_': 'Ngoài 11 hệ Eurohouse đang được duyệt.',
  'TẤM_': 'Nhôm tấm không cùng mô hình dữ liệu Profile dạng cây.',
  '02_03_25_(5)': 'Sheet tổng hợp bị lỗi #REF và lặp dữ liệu các sheet nguồn.',
  'TỔNG_HỢP_SỐ_LG_ĐƠN_HÀNG': 'Sheet tổng hợp số lượng, không phải dữ liệu danh mục.',
};

// Canonical codes preserve identifiers already used by orders, inventory and formulas.
const CODE_ALIASES = {
  'CN 55': 'CN55',
  DD55: 'PR-DD55',
  'E55-125P': 'E55-D125P',
  'LH 5110': 'LH5110',
  'KH T9801': 'KH-T9801',
  'KH T9802': 'KH-T9802',
  'KH T9803': 'KH-T9803',
  'KH T9804': 'KH-T9804',
  'KH T9805': 'KH-T9805',
  'KH T9806': 'KH-T9806',
  'KH T9807': 'KH-T9807',
  'KH T9808': 'KH-T9808',
  'KH T9809': 'KH-K9809',
  'KH T9810': 'KH-K9810',
  'KH T9811': 'KH-T9811',
  'KH T9812': 'KH-K9812',
  'KH T9813': 'KH-T9813',
  KTL01: 'KTL-01',
  KTL03: 'KTL-03',
  KTL04: 'KTL-04',
  KTL05: 'KTL-05',
  KTL06: 'KTL-06',
  KTL07: 'KTL-07',
  '50*150': '50X150',
  'ECS20-30x150': 'ECS20-30X150',
  'C 3318 1.2': 'C3318',
};

const SYSTEM_CODE_ALIASES = {
  'EU-70:E701': 'E701A',
  'EU-70:E704': 'E704A',
  'EU-70:E70S86S': 'E70S86',
  'EU-ECPLUS:C3323': 'C3323-ND',
};

const r19 = (systemCode, code, name, thicknessMm, kgPerMeter, page, sourceCode = code) => ({
  systemCode, code, name, thicknessMm, kgPerMeter, page, sourceCode, source: 'R19',
});

// Values below were transcribed from the rendered R19 profile tables, not inferred from drawings.
const R19_PROFILES = [
  r19('EU-55', 'DAK55', 'Khung bao', '1.2', 0.82, 2),
  r19('EU-55', 'LH5110', 'Khung bao VIP', '1.3', 1.387, 2),
  r19('EU-55', 'KHK65', 'Khung bao phào ngoài', '1.2', 1.13, 2),
  r19('EU-55', 'LH11801', 'Cánh cửa đi VIP', '1.2-1.4', 1.369, 2),
  r19('EU-55', 'DAD91', 'Cánh cửa đi', '1.3', 1.07, 2),
  r19('EU-55', 'DAS76', 'Cánh cửa sổ', '1.2', 0.9, 2),
  r19('EU-55', 'DATD76', 'Đố cánh 76', '1.2', 0.91, 2),
  r19('EU-55', 'DAT55', 'Đố chia khung', '1.2', 0.89, 2),
  r19('EU-55', 'PR-DD55', 'Đố động', '1.0', 0.664, 2),
  r19('EU-55', 'DAS14', 'Sập vách vuông', '1.0', 0.217, 2),
  r19('EU-55', 'DA3002', 'Pano', '0.7', 0.484, 2),
  r19('EU-55', 'CN55', 'Ốp đáy cửa đi', '1.2', 0.229, 2),
  r19('EU-55', 'C3300', 'Thanh nối khung', '2.0', 0.348, 2),
  r19('EU-55', 'E55-D125P', 'Cánh cửa đi liền phào', '1.2', 1.392, 2),
  r19('EU-55', 'E55-S100P', 'Cánh cửa sổ liền phào', '1.1', 1.165, 2),
  r19('EU-55', 'E192', 'Lá chớp', '0.9', 0.317, 2),
  r19('EU-55', 'E1283A', 'Khung chớp', '1.2', 0.29, 2),
  r19('EU-55', 'C3326', 'Nối khung 90 độ', '2.2', 1.275, 2),
  r19('EU-55', 'ECS01', 'Khung ôm tường', '1.3', 1.391, 2),
  r19('EU-55', 'EPV55', 'Phào viền cánh', '0.8', 0.509, 2),
  r19('EU-55', 'PR5542', 'Khung cửa trượt', '1-1.25', 0.78, 2),
  r19('EU-55', 'PR2966', 'Cánh cửa trượt', '1.0', 0.681, 2),
  r19('EU-55', 'PR55N', 'Nẹp sập cửa trượt', '1.0', 0.258, 2),
  r19('EU-55', 'PR55M', 'Nẹp móc cửa trượt', '1.2', 0.341, 2),
  r19('EU-55', 'PR5512', 'Ray mỏng cửa lùa', '1.0', 0.381, 2),
  r19('EU-55', 'PR2990', 'Cánh trượt bản 90mm', '1.2', 0.923, 2),
  r19('EU-55', 'PR55M90', 'Nẹp móc cửa trượt bản 90', '1.0', 0.381, 2),

  r19('EU-PRECO', 'PRK50', 'Khung cửa', '1-1.1', 0.664, 3),
  r19('EU-PRECO', 'PRD91', 'Cánh đi mỏng 91', '1.0', 0.877, 3),
  r19('EU-PRECO', 'PRS76', 'Cánh sổ mỏng 76', '0.9', 0.744, 3),
  r19('EU-PRECO', 'C3300', 'Sập nối khung', '2.0', 0.348, 3),
  r19('EU-PRECO', 'DAT55', 'Đố khung', '1.2', 0.89, 3),
  r19('EU-PRECO', 'DATD76', 'Đố cánh', '1.2', 0.91, 3),
  r19('EU-PRECO', 'PR-DD55', 'Đố động', '1.0', 0.664, 3),
  r19('EU-PRECO', 'DA3002', 'Pano', '0.7', 0.484, 3),
  r19('EU-PRECO', 'DAS14', 'Sập vách', '1.0', 0.217, 3),
  r19('EU-PRECO', 'CN55', 'Ốp đáy cửa đi', '1.2', 0.207, 3),
  r19('EU-PRECO', 'C3326', 'Chuyển góc 90 độ', '2.2', 1.275, 3),
  r19('EU-PRECO', 'PRK55', 'Khung PRK55', '0.9', 0.65, 3),
  r19('EU-PRECO', 'PR5542', 'Khung cửa trượt', '1-1.25', 0.78, 3),
  r19('EU-PRECO', 'PR2966', 'Cánh cửa trượt', '1.0', 0.681, 3),
  r19('EU-PRECO', 'PR55N', 'Nẹp sập cửa trượt', '1.0', 0.258, 3),
  r19('EU-PRECO', 'PR55M', 'Nẹp móc cửa trượt', '1.2', 0.341, 3),
  r19('EU-PRECO', 'C3318', 'Khung bao cửa sổ', '1.2', 0.751, 4, 'C3318-1.2'),
  r19('EU-PRECO', 'C3328', 'Khung bao cửa đi', '1.4', 0.948, 4, 'C3328-1.4'),
  r19('EU-PRECO', 'C3202', 'Cánh cửa sổ', '1.2', 0.981, 4, 'C3202-1.2'),
  r19('EU-PRECO', 'C3303', 'Cánh cửa đi mở ngoài', '1.4', 1.173, 4, 'C3303-1.4'),
  r19('EU-PRECO', 'C3332', 'Cánh cửa đi mở trong', '1.4', 1.174, 4, 'C3332-1.4'),
  r19('EU-PRECO', 'C3313', 'Đố cố định chia khung', '1.2', 0.905, 4, 'C3313-1.2'),
  r19('EU-PRECO', 'C3203', 'Đố chia cánh', '1.2', 0.853, 4, 'C3203-1.2'),
  r19('EU-PRECO', 'C3209', 'Khung bao vách', '1.4', 0.805, 4),
  r19('EU-PRECO', 'C3323', 'Đố động dùng chung', '1.4', 0.856, 4),
  r19('EU-PRECO', 'C3304', 'Cánh ngang dưới cửa đi', '1.4', 1.529, 4, 'C3304-1.4'),
  r19('EU-PRECO', 'C3329', 'Ốp đáy cửa đi', '1.5', 0.428, 4),
  r19('EU-PRECO', 'C3329A', 'Ốp đáy cửa đi cải tiến', '1.5', 0.458, 4),
  r19('EU-PRECO', 'E192', 'Lá chớp', '0.9', 0.317, 4),
  r19('EU-PRECO', 'E1283A', 'Khung chớp', '1.2', 0.29, 4),
  r19('EU-PRECO', 'C3295', 'Nẹp kính cánh', '1.0', 0.271, 4),
  r19('EU-PRECO', 'C3336', 'Nẹp cánh kính hộp', '1.0', 0.227, 4),
  r19('EU-PRECO', 'C3296', 'Nẹp kính khung', '1.0', 0.237, 4),
  r19('EU-PRECO', 'C3225', 'Nẹp khung kính hộp', '1.0', 0.211, 4),

  r19('EU-NOITHAT', 'KH01', 'Phào nóc', '0.9', 0.72, 5),
  r19('EU-NOITHAT', 'KH17', 'Cánh tủ', '0.9', 0.502, 5),
  r19('EU-NOITHAT', 'KH03', 'Pano 16', '0.9', 0.755, 5),
  r19('EU-NOITHAT', 'KH04', 'Cột sau', '1.0', 0.312, 5),
  r19('EU-NOITHAT', 'KH05', 'Khung vách', '0.8', 0.351, 5),
  r19('EU-NOITHAT', 'KH06', 'Cột trước', '1.0', 0.817, 5),
  r19('EU-NOITHAT', 'KH07', 'Đố chia vách', '1.0', 0.219, 5),
  r19('EU-NOITHAT', 'KH08', 'Lá chớp', '0.7', 0.422, 5),
  r19('EU-NOITHAT', 'KH09', 'U16', '1.0', 0.13, 5),
  r19('EU-NOITHAT', 'KH10', 'Thanh ngang', '1.0', 0.497, 5),
  r19('EU-NOITHAT', 'KH11', 'Cây ngăn kéo', '1.0', 0.205, 5),
  r19('EU-NOITHAT', 'KH12', 'Phào nhỏ', '1.0', 0.303, 5),
  r19('EU-NOITHAT', 'KH13', 'Cột trước nhỏ', '0.8', 0.484, 5),
  r19('EU-NOITHAT', 'KH14', 'U8', '0.9', 0.146, 5),
  r19('EU-NOITHAT', 'KH15', 'Pano', '0.6', 0.441, 5),
  r19('EU-NOITHAT', 'KH16', 'Nan trang trí', '1.4', 0.065, 5),

  r19('EU-TQ', 'KH-TQ01', 'Ray khung', '2.0', 1.058, 7, 'KT-TQ01'),
  r19('EU-TQ', 'KH-TQ02', 'Ray cánh', '2-2.8', 1.507, 7, 'KT-TQ02'),
  r19('EU-TQ', 'KH-TQ03', 'Khung', '1.6', 1.718, 7, 'KT-TQ03'),
  r19('EU-TQ', 'KH-TQ04', 'Cánh trên', '1.7', 1.422, 7, 'KT-TQ04'),
  r19('EU-TQ', 'KH-TQ05', 'Cánh đứng móc', '1.7', 1.385, 7, 'KT-TQ05'),
  r19('EU-TQ', 'KH-TQ06', 'Cánh bản lề', '1.7', 1.521, 7, 'KT-TQ06'),
  r19('EU-TQ', 'KH-TQ07', 'Cánh dưới', '1.7', 1.23, 7, 'KT-TQ07'),
  r19('EU-TQ', 'KH-TQ08', 'Cánh ngoài', '1.7', 1.712, 7, 'KT-TQ08'),
  r19('EU-TQ', 'KH-TQ09', 'Sập nối cánh', '1.3', 0.32, 7, 'KT-TQ09'),
  r19('EU-TQ', 'KH-TQ10', 'Nẹp che phụ kiện', '1.6', 0.092, 7),

  r19('EU-TRUOT', 'KH-T9801', 'Cánh trượt', '1.3-1.5', 1.4, 7),
  r19('EU-TRUOT', 'KH-T9802', 'Khung', '1.5', 1.43, 7),
  r19('EU-TRUOT', 'KH-T9803', 'Ray dưới', '1.6', 0.714, 7),
  r19('EU-TRUOT', 'KH-T9804', 'Khung đơn', '1.5', 0.653, 7),
  r19('EU-TRUOT', 'KH-T9805', 'Ray đơn', '1.5', 0.44, 7),
  r19('EU-TRUOT', 'KH-T9806', 'Nẹp đối đầu', '1.4', 0.282, 7),
  r19('EU-TRUOT', 'KH-T9807', 'Ray U', '1.6', 0.206, 7),
  r19('EU-TRUOT', 'KH-T9808', 'Nẹp móc liền tay cầm', '1.4', 1.04, 7),
  r19('EU-TRUOT', 'KH-K9809', 'Nẹp kính', '1.2', 0.214, 7),
  r19('EU-TRUOT', 'KH-K9810', 'Nẹp kính hộp', '1.2', 0.18, 7),
  r19('EU-TRUOT', 'KH-K9812', 'Nẹp đối đầu 90 độ', '1.4', 0.487, 7),
  r19('EU-TRUOT', 'KH-T9813', 'Nẹp móc', '1.4', 0.47, 7),
  r19('EU-TRUOT', 'KH-T9814', 'Thanh U đứng', '1.5', 0.24, 7),

  r19('EU-TL', 'KTL-01', 'Cánh cửa 180', '2.0', 3.06, 7),
  r19('EU-TL', 'KTL-05', 'Khung bao 200', '2.0', 3.37, 7),
  r19('EU-TL', 'KTL-03', 'Nẹp kính hộp', '1.3', 0.23, 7),
  r19('EU-TL', 'KTL-04', 'Nẹp kính', '1.3', 0.364, 7),
  r19('EU-TL', 'KTL08', 'Nẹp kính hộp vuông', '1.3', 0.301, 7),
  r19('EU-TL', 'KTL-06', 'Đế sập', '1.5', 0.377, 7),
  r19('EU-TL', 'KTL-07', 'Nẹp kính vuông', '1.3', 0.344, 7),
  r19('EU-TL', 'KTL09', 'Đế sập kính hộp', '1.5', 0.417, 7),
  r19('EU-TL', 'C101', 'Nẹp vách', '0.9', 0.133, 7),

  r19('EU-70', 'E701A', 'Khung liền phào', '1.6', 1.385, 9),
  r19('EU-70', 'E70D110', 'Cánh đi E70 sập rời', '1.5', 1.963, 9),
  r19('EU-70', 'E70S86', 'Cánh sổ E70 sập rời', '1.3', 1.515, 9),
  r19('EU-70', 'E70SH', 'Sập kính thường', '1.2', 0.266, 9),
  r19('EU-70', 'T9809', 'Sập kính hộp', '1.2', 0.214, 9),
  r19('EU-70', 'E70KD', 'Khung đơn cửa đi', '1.6', 1.214, 9),
  r19('EU-70', 'E704A', 'Đố chia khung', '1.6', 1.214, 9),
  r19('EU-70', 'C3296', 'Nẹp kính vách', '1.0', 0.237, 9),
  r19('EU-70', 'C3225', 'Nẹp vách kính hộp', '1.0', 0.211, 9),
  r19('EU-70', 'E70T98', 'Đố khung 98mm', '1.7', 1.498, 9),
  r19('EU-70', 'E70D190', 'Cánh cửa đi Ecento 190', '1.8', 2.91, 9),
  r19('EU-70', 'E70D150', 'Cánh cửa đi Ecento 150', '1.5', 2.393, 9),
  r19('EU-70', 'KTL-04', 'Nẹp kính cong cho cánh 150 và 190', '1.3', 0.364, 9),
  r19('EU-70', 'KTL-07', 'Nẹp kính vuông cho cánh 150 và 190', '1.3', 0.344, 9),
  r19('EU-70', 'KTL-03', 'Nẹp kính hộp cho cánh 150 và 190', '1.3', 0.23, 9),
  r19('EU-70', 'E70NK', 'Nối khung', '2.0', 0.373, 9),
  r19('EU-70', 'E705', 'Đố động', '1.4', 0.914, 9),
  r19('EU-70', 'E706', 'Nẹp chân cánh', '1.3', 0.34, 9),
  r19('EU-70', 'E702', 'Nẹp phẳng', '1.3', 0.096, 9),
  r19('EU-70', 'E70KT', 'Khung thấp', '1.8', 0.72, 9),

  r19('EU-CS', 'ECS01', 'Khung chấn song hệ 55', '1.3', 1.391, 10),
  r19('EU-CS', 'ECS02', 'Khung ôm tường Ecento 70', '1.2-1.45', 1.852, 10),
  r19('EU-CS', 'ECS03', 'Nối khung', '1.2', 1.275, 10),
  r19('EU-CS', 'ECS04', 'Phào rời', '1.0', 0.374, 10),
  r19('EU-CS', 'ECS05', 'Chấn song D28', '1.6', 0.424, 10),
  r19('EU-CS', 'ECS06', 'Thanh định vị chấn song', '1.0', 0.279, 10),
  r19('EU-CS', 'ECS07', 'Thanh đố ngang', '1.2', 0.581, 10),
  r19('EU-CS', 'ECS08', 'Nắp bịt khung', '1.0', 0.125, 10),
  r19('EU-CS', 'ECS09', 'Nối phào', '1.0', 0.233, 10),
  r19('EU-CS', 'ECS10', 'Phào dài', '1.0', 0.458, 10),
  r19('EU-CS', 'ECS11', 'Nối khung 3cm', '1.0', 0.491, 10),
  r19('EU-CS', 'ECS12', 'Thanh song lục giác', '1.8', 0.537, 10),
  r19('EU-CS', 'ECS13', 'Thanh đố ngang 75mm', '1.1', 0.81, 10),
  r19('EU-CS', 'ECS14', 'Phào 55mm', '0.9', 0.494, 10),
  r19('EU-CS', 'ECS15', 'Chấn song chữ nhật', '1.1', 0.409, 10),
  r19('EU-CS', 'ECS17', 'Hộp 25x120', '1.2', 1.2, 10),
  r19('EU-CS', '50X150', 'Hộp 50x150', '1.8', 2.134, 10),
  r19('EU-CS', 'ECS18', 'Phào cân', '1.0', 0.345, 10),
  r19('EU-CS', 'ECS20-30X150', 'Hộp 30x150', '1.2', 1.367, 10),
  r19('EU-CS', 'ECS22-P75', 'Phào ôm tường 75mm', '1.0', 0.643, 10),
  r19('EU-CS', 'ECS21-P100', 'Phào nóc 100mm', '1.0', 1.076, 10),

  r19('EU-ECPLUS', 'C3328P', 'Khung liền phào', '1.3', 1.179, 12),
  r19('EU-ECPLUS', 'C3328-1.4', 'Khung phẳng', '1.4', 0.948, 12),
  r19('EU-ECPLUS', 'EPK116', 'Khung ôm tường Ecento Plus', '1.2', 1.553, 12),
  r19('EU-ECPLUS', 'EPD98', 'Cánh cửa đi', '1.4', 1.363, 12),
  r19('EU-ECPLUS', 'EPS78', 'Cánh cửa sổ', '1.2', 1.127, 12),
  r19('EU-ECPLUS', 'EPTD80', 'Đố cánh', '1.2', 1.008, 12),
  r19('EU-ECPLUS', 'C3323-ND', 'Đố động dùng chung', '1.2', 0.789, 12),
  r19('EU-ECPLUS', 'C3313', 'Đố chia khung', '1.2', 0.899, 12),
  r19('EU-ECPLUS', 'C3329A', 'Ốp chân cánh', '1.0', 0.458, 12),
  r19('EU-ECPLUS', 'C3296', 'Nẹp kính vách', '1.0', 0.237, 12),
  r19('EU-ECPLUS', 'EPS78S', 'Cánh cửa sổ sập rời', '1.3', 1.012, 12),
  r19('EU-ECPLUS', 'EPD98S', 'Cánh cửa đi sập rời', '1.5', 1.275, 12),
  r19('EU-ECPLUS', 'E70SH', 'Sập kính thường', '1.2', 0.266, 12),
  r19('EU-ECPLUS', 'T9809', 'Sập kính hộp', '1.2', 0.214, 12),
  r19('EU-ECPLUS', 'EPD138', 'Cánh Ecento Plus 138mm', '1.5-1.7', 1.817, 12),
  r19('EU-ECPLUS', 'EPD125P', 'Cánh cửa đi liền phào 125', '1.4-1.7', 1.525, 12),
  r19('EU-ECPLUS', 'EPS20-125', 'Nẹp kính hộp 20mm', '1.2', 0.311, 12),
  r19('EU-ECPLUS', 'EPS12-125', 'Nẹp kính 12mm', '1.1', 0.343, 12),
  r19('EU-ECPLUS', 'EPD138P', 'Cánh liền phào 138', '1.6-2.0', 2.113, 12),
  r19('EU-ECPLUS', 'EPSV11', 'Sập vách phẳng', '1.0', 0.338, 12),
  r19('EU-ECPLUS', 'EPT90', 'Đố khung bản 90mm', '1.8', 1.331, 12),

  r19('EU-PDH', 'ECS23', 'Định vị phào kiểu Pháp', '5.0', 1.251, 15),
  r19('EU-PDH', 'DH01', 'Khung chính', '1.5', 1.423, 16),
  r19('EU-PDH', 'DH02', 'Cột phụ', '1.5', 0.361, 16),
  r19('EU-PDH', 'DH03', 'Đế ốp', '1.5', 0.228, 16),
  r19('EU-PDH', 'DH04', 'Cột chính ghép pano', '1.2', 0.606, 16),
  r19('EU-PDH', 'DH05', 'Cột phụ cải tiến', '1.1', 0.439, 16),
  r19('EU-PDH', 'KH01CT', 'Phào đỉnh', '1.0', 0.69, 16),
  r19('EU-PDH', 'EPV01', 'Phào nối đỉnh', '1.0', 0.348, 16),
  r19('EU-PDH', 'ECS21-P100', 'Phào nóc 100mm', '1.0', 1.076, 16),
  r19('EU-PDH', 'KH10', 'Thanh ngang', '1.0', 0.497, 16),
  r19('EU-PDH', 'ECS18', 'Phào cân', '1.0', 0.344, 16),
  r19('EU-PDH', 'KH09', 'U16', '1.0', 0.13, 16),

  r19('EU-MD', 'EMD6577', 'Khung mặt dựng 65x77', '2.0', 1.615, 17),
  r19('EU-MD', 'EMD65100', 'Khung mặt dựng 65x100', '2.5', 2.245, 17),
  r19('EU-MD', 'EMD65120', 'Khung mặt dựng 65x120', '2.0', 2.106, 17),
  r19('EU-MD', 'EMDK46', 'Khung cửa sổ', '1.5-2.0', 0.75, 17),
  r19('EU-MD', 'EMDS38', 'Cánh cửa sổ', '1.5', 0.8, 17),
  r19('EU-MD', 'EMD52X120', 'Khung mặt dựng 52x120', '1.5-2.0', 1.612, 17),
];

const KNOWN_SOURCE_CONFLICTS = [
  {
    source: 'R19', page: 17, code: 'EMD52D', systemCode: 'EU-MD',
    reason: 'Catalog in cùng mã EMD52D cho cả đế nẹp và thanh nẹp; không thể tạo hai Profile cùng mã.',
  },
  {
    source: 'R19', page: 14, code: 'NT700/EPV01/TQ10/EPV02/EPV55',
    reason: 'Trang EuroART không chỉ rõ một hệ chuẩn duy nhất; không dùng riêng trang 14 để tự đổi phân hệ. Mã chỉ được map khi có bằng chứng độc lập ở sheet/hệ khác.',
  },
];

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

function cellValue(cell) {
  const value = cell.value;
  if (value && typeof value === 'object') {
    if ('result' in value) return value.result;
    if ('text' in value) return value.text;
    if ('richText' in value) return value.richText.map((item) => item.text).join('');
  }
  return value;
}

function canonicalCode(systemCode, rawCode) {
  const trimmed = String(rawCode ?? '').trim().replace(/\s+/g, ' ');
  const globallyCanonical = CODE_ALIASES[trimmed] ?? trimmed.toUpperCase();
  return SYSTEM_CODE_ALIASES[`${systemCode}:${globallyCanonical}`] ?? globallyCanonical;
}

async function readWorkbookProfiles() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);
  const profiles = [];
  const conflicts = [];
  const excluded = [];

  for (const worksheet of workbook.worksheets) {
    const systemCode = SHEET_TO_SYSTEM[worksheet.name];
    if (!systemCode) {
      excluded.push({ sheet: worksheet.name, reason: EXCLUDED_SHEETS[worksheet.name] ?? 'Không có ánh xạ hệ.' });
      continue;
    }

    const grouped = new Map();
    worksheet.eachRow((row, rowNumber) => {
      const stt = cellValue(row.getCell(1));
      const rawCode = cellValue(row.getCell(2));
      const name = cellValue(row.getCell(3));
      const kgPerMeter = Number(cellValue(row.getCell(4)));
      const barsPerBundle = Number(cellValue(row.getCell(5)));
      const lengthM = Number(cellValue(row.getCell(6)));
      if (!Number.isFinite(Number(stt)) || typeof rawCode !== 'string' || typeof name !== 'string') return;
      if (!Number.isFinite(kgPerMeter) || kgPerMeter <= 0) return;

      const code = canonicalCode(systemCode, rawCode);
      const candidate = {
        systemCode,
        code,
        sourceCode: rawCode.trim(),
        name: name.trim(),
        kgPerMeter,
        barsPerBundle: Number.isInteger(barsPerBundle) && barsPerBundle > 0 ? barsPerBundle : null,
        barLengthMm: Number.isFinite(lengthM) && lengthM > 0 ? Math.round(lengthM * 1000) : null,
        sheet: worksheet.name,
        row: rowNumber,
        source: 'WORKBOOK',
      };
      const key = `${systemCode}:${code}`;
      const existing = grouped.get(key) ?? [];
      existing.push(candidate);
      grouped.set(key, existing);
    });

    for (const [key, candidates] of grouped) {
      const signatures = new Set(candidates.map((item) => JSON.stringify([
        item.kgPerMeter, item.barsPerBundle, item.barLengthMm,
      ])));
      if (signatures.size > 1) {
        conflicts.push({ key, reason: 'Một mã có nhiều tỷ trọng/quy cách/chiều dài trong cùng sheet.', candidates });
        continue;
      }
      profiles.push(candidates[0]);
    }
  }

  return { profiles, conflicts, excluded };
}

function mergeSources(workbookProfiles) {
  const merged = new Map();
  for (const profile of workbookProfiles) merged.set(`${profile.systemCode}:${profile.code}`, { ...profile });
  for (const profile of R19_PROFILES) {
    const key = `${profile.systemCode}:${profile.code}`;
    const workbook = merged.get(key);
    merged.set(key, {
      ...workbook,
      ...profile,
      barsPerBundle: workbook?.barsPerBundle ?? null,
      barLengthMm: workbook?.barLengthMm ?? 6000,
      workbookEvidence: workbook ? { sheet: workbook.sheet, row: workbook.row, sourceCode: workbook.sourceCode } : null,
    });
  }
  return [...merged.values()];
}

function changeSet(existing, candidate) {
  if (!existing) return { action: 'create', changes: candidate };
  const changes = {};
  if (candidate.source === 'R19') {
    for (const field of ['name', 'thicknessMm', 'kgPerMeter']) {
      if (candidate[field] != null && existing[field] !== candidate[field]) changes[field] = candidate[field];
    }
  }
  for (const field of ['barsPerBundle', 'barLengthMm']) {
    if (candidate[field] != null && existing[field] !== candidate[field]) changes[field] = candidate[field];
  }
  if (candidate.imageUrl && existing.imageUrl !== candidate.imageUrl) changes.imageUrl = candidate.imageUrl;
  return { action: Object.keys(changes).length ? 'update' : 'unchanged', changes };
}

async function ensureTechnicalSource(data) {
  const existing = await prisma.technicalSource.findFirst({ where: { sourceHash: data.sourceHash } });
  if (existing) return existing;
  const actor = await prisma.user.findFirst({
    where: { role: 'ADMIN', isCeo: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, organizationId: true },
  });
  if (!actor) throw new Error('Cần tài khoản CEO Admin để đăng ký nguồn dữ liệu kỹ thuật.');
  return prisma.$transaction(async (tx) => {
    const created = await tx.technicalSource.create({
      data: {
        ...data,
        ownerOrganizationId: actor.organizationId,
        enteredById: actor.id,
        reviewState: 'UNREVIEWED',
      },
    });
    await tx.technicalReviewEvent.create({
      data: {
        entityType: 'TECHNICAL_SOURCE', entityId: created.id, action: 'CREATE',
        toStatus: 'UNREVIEWED', actorId: actor.id,
        notes: 'Nguồn được nạp để đối chiếu danh mục; không tự động phê duyệt công thức cắt.',
      },
    });
    return created;
  });
}

async function backupCatalog() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(WORKSPACE_ROOT, '..', 'BACKUPS', 'EUROHOUSE_CATALOG_R19');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `catalog-before-r19-${timestamp}.json`);
  const [systems, sources] = await Promise.all([
    prisma.aluSystem.findMany({ orderBy: { sortOrder: 'asc' }, include: { profiles: { orderBy: { code: 'asc' } } } }),
    prisma.technicalSource.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);
  fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date(), systems, sources }, null, 2)}\n`, 'utf8');
  return backupPath;
}

async function main() {
  for (const [filePath, expected] of [[WORKBOOK_PATH, EXPECTED_WORKBOOK_HASH], [PDF_PATH, EXPECTED_PDF_HASH]]) {
    if (!fs.existsSync(filePath)) throw new Error(`Thiếu file nguồn: ${filePath}`);
    const actual = sha256(filePath);
    if (actual !== expected) throw new Error(`Hash file nguồn đã thay đổi: ${path.basename(filePath)} (${actual})`);
  }

  const workbook = await readWorkbookProfiles();
  const candidates = mergeSources(workbook.profiles);
  const systems = await prisma.aluSystem.findMany({
    where: { code: { in: [...new Set(candidates.map((item) => item.systemCode))] } },
    include: { profiles: true },
  });
  const systemByCode = new Map(systems.map((system) => [system.code, system]));
  const plan = [];
  for (const candidate of candidates) {
    const system = systemByCode.get(candidate.systemCode);
    if (!system) {
      plan.push({ action: 'error', key: `${candidate.systemCode}:${candidate.code}`, reason: 'Thiếu hệ nhôm trong database.' });
      continue;
    }
    const imagePath = path.join(WORKSPACE_ROOT, 'apps', 'api', 'public', 'profiles', `${candidate.code}.png`);
    candidate.imageUrl = fs.existsSync(imagePath) ? `/static/profiles/${candidate.code}.png` : null;
    const existing = system.profiles.find((profile) => profile.code === candidate.code);
    const decision = changeSet(existing, candidate);
    plan.push({ ...decision, key: `${candidate.systemCode}:${candidate.code}`, candidate, existingId: existing?.id ?? null });
  }

  const summary = plan.reduce((acc, item) => {
    acc[item.action] = (acc[item.action] ?? 0) + 1;
    return acc;
  }, {});
  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    sourceHashes: { workbook: EXPECTED_WORKBOOK_HASH, r19: EXPECTED_PDF_HASH },
    candidateCount: candidates.length,
    workbookConflicts: workbook.conflicts,
    knownSourceConflicts: KNOWN_SOURCE_CONFLICTS,
    excludedSheets: workbook.excluded,
    summary,
    creates: plan.filter((item) => item.action === 'create').map((item) => ({ key: item.key, candidate: item.candidate })),
    updates: plan.filter((item) => item.action === 'update').map((item) => ({ key: item.key, changes: item.changes, source: item.candidate.source, page: item.candidate.page })),
    errors: plan.filter((item) => item.action === 'error'),
  };

  if (WRITE_SNAPSHOT) {
    const snapshotPath = path.join(WORKSPACE_ROOT, 'apps', 'api', 'prisma', 'catalog-r19-snapshot.json');
    const snapshot = {
      revision: 'R19 / 2026-10-02',
      generatedFrom: {
        catalogSha256: EXPECTED_PDF_HASH,
        workbookSha256: EXPECTED_WORKBOOK_HASH,
      },
      profiles: candidates.map((candidate) => ({
        systemCode: candidate.systemCode,
        code: candidate.code,
        name: candidate.name,
        thicknessMm: candidate.thicknessMm ?? null,
        kgPerMeter: candidate.kgPerMeter,
        barsPerBundle: candidate.barsPerBundle ?? 0,
        barLengthMm: candidate.barLengthMm ?? 6000,
      })),
      excluded: {
        workbookConflicts: workbook.conflicts.map(({ key, reason }) => ({ key, reason })),
        sourceConflicts: KNOWN_SOURCE_CONFLICTS,
        sheets: workbook.excluded,
      },
    };
    fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    report.snapshotPath = snapshotPath;
  }

  if (!APPLY) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (report.errors.length) throw new Error(`Kế hoạch import có ${report.errors.length} lỗi; dừng trước khi ghi.`);

  const backupPath = await backupCatalog();
  const [r19Source, workbookSource] = await Promise.all([
    ensureTechnicalSource({
      sourceType: 'OFFICIAL_CATALOGUE', sourceDocument: 'EUROHOUSE CATALOG R19',
      sourceRevision: 'R19 / 2026-10-02', sourcePage: '2-17', sourceHash: EXPECTED_PDF_HASH,
      sourceDate: new Date('2026-10-02T00:00:00.000Z'), technicalOwner: '',
      notes: 'Nguồn mới nhất cho mã profile, mặt cắt, độ dày và kg/m được in. Không phê duyệt công thức cắt, gia công, kính, gioăng hoặc phụ kiện.',
      metadata: { fileName: path.basename(PDF_PATH), pageCount: 18, ingestionScope: ['PROFILE_IDENTITY', 'PROFILE_SECTION', 'NOMINAL_THICKNESS', 'KG_PER_METER'] },
    }),
    ensureTechnicalSource({
      sourceType: 'OTHER', sourceDocument: 'Đơn đặt hàng (Recovered)',
      sourceRevision: '2026-09-25 recovered workbook', sourcePage: 'Mapped system sheets', sourceHash: EXPECTED_WORKBOOK_HASH,
      sourceDate: new Date('2026-09-25T00:00:00.000Z'), technicalOwner: '',
      notes: 'Nguồn vận hành cho mã hàng, quy cách cây/bó và chiều dài. Không dùng cột tổng kg của đơn làm kg thực tế theo từng mã cây.',
      metadata: { fileName: path.basename(WORKBOOK_PATH), ingestionScope: ['PROFILE_IDENTITY', 'BARS_PER_BUNDLE', 'BAR_LENGTH'] },
    }),
  ]);

  let applied = 0;
  for (const item of plan.filter((entry) => entry.action === 'create' || entry.action === 'update')) {
    const candidate = item.candidate;
    const system = systemByCode.get(candidate.systemCode);
    const imagePath = path.join(WORKSPACE_ROOT, 'apps', 'api', 'public', 'profiles', `${candidate.code}.png`);
    const baseData = {
      name: candidate.name,
      kgPerMeter: candidate.kgPerMeter,
      barsPerBundle: candidate.barsPerBundle ?? 0,
      barLengthMm: candidate.barLengthMm ?? 6000,
      thicknessMm: candidate.thicknessMm ?? null,
      imageUrl: fs.existsSync(imagePath) ? `/static/profiles/${candidate.code}.png` : null,
    };
    const saved = item.action === 'create'
      ? await prisma.profile.create({ data: { aluSystemId: system.id, code: candidate.code, pricePerKg: 92000, ...baseData } })
      : await prisma.profile.update({ where: { id: item.existingId }, data: item.changes });
    const fields = (item.action === 'create' ? Object.keys(baseData) : Object.keys(item.changes))
      .filter((field) => field !== 'imageUrl');
    for (const fieldPath of fields) {
      const isWorkbookField = ['barsPerBundle', 'barLengthMm'].includes(fieldPath) && candidate.workbookEvidence;
      const source = candidate.source === 'R19' && !isWorkbookField ? r19Source : workbookSource;
      const evidenceNote = isWorkbookField
        ? `${candidate.workbookEvidence.sheet} dòng ${candidate.workbookEvidence.row}`
        : candidate.page ? `R19 trang ${candidate.page}` : `${candidate.sheet} dòng ${candidate.row}`;
      await prisma.technicalSourceLink.upsert({
        where: { technicalSourceId_entityType_entityId_fieldPath: {
          technicalSourceId: source.id, entityType: 'PROFILE', entityId: saved.id, fieldPath,
        } },
        update: { notes: evidenceNote },
        create: {
          technicalSourceId: source.id, entityType: 'PROFILE', entityId: saved.id, fieldPath,
          notes: evidenceNote,
        },
      });
    }
    applied += 1;
  }
  console.log(JSON.stringify({ ...report, backupPath, applied }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
