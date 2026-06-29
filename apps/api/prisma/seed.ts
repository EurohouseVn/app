import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 4 hệ nhôm chính (gom nhóm từ phiếu xuất kho + catalog R17)
const aluSystems = [
  { code: 'EU-55', name: 'Hệ 55 mở quay', description: 'Cửa đi & cửa sổ mở quay hệ 55', sortOrder: 1 },
  { code: 'EU-TRUOT', name: 'Hệ trượt Xingfa', description: 'Cửa trượt lùa, trượt quay', sortOrder: 2 },
  { code: 'EU-70', name: 'Hệ 70 cao cấp', description: 'Cửa đi & cửa sổ hệ 70', sortOrder: 3 },
  { code: 'EU-TL', name: 'Hệ thủy lực & mặt dựng', description: 'Khung thủy lực, mặt dựng, trang trí', sortOrder: 4 },
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

// 94 thanh nhôm thật từ "pxk mẫu.xlsx": [hệ, mã cây, tên, tỉ trọng kg/m, quy cách cây/bó]
const profiles: [string, string, string, number, number][] = [
  ['EU-55', 'LH5110', 'Khung cửa đi & cửa sổ hệ 55 V', 1.368, 2],
  ['EU-55', 'LH11801', 'Cánh cửa đi bản rộng', 1.369, 2],
  ['EU-55', 'DATD91', 'Đố cánh cửa bản rộng', 1.061, 4],
  ['EU-55', 'DAK55', 'Khung cửa đi & cửa sổ', 0.804, 4],
  ['EU-55', 'DAD91', 'Cánh cửa đi', 1.098, 4],
  ['EU-55', 'DAS76', 'Cánh cửa sổ', 0.901, 4],
  ['EU-55', 'DAT55', 'Đố khung', 0.941, 4],
  ['EU-55', 'DATD76', 'Đố cánh', 0.997, 4],
  ['EU-55', 'DD55', 'Đố động', 0.658, 4],
  ['EU-55', 'DAS14', 'Nẹp vách', 0.217, 10],
  ['EU-55', 'DA3002', 'Pano', 0.484, 10],
  ['EU-55', 'CN55', 'Sập chân cánh', 0.233, 10],
  ['EU-55', 'PRK55', 'Khung cửa đi & cửa sổ 55', 0.664, 4],
  ['EU-55', 'PRK50', 'Khung cửa đi & cửa sổ 50', 0.664, 4],
  ['EU-55', 'PRD91', 'Cánh cửa đi 91', 0.8645, 4],
  ['EU-55', 'PRS76', 'Cánh cửa sổ 76', 0.744, 4],
  ['EU-55', 'PRD86', 'Cánh cửa đi 86', 0.857, 4],
  ['EU-55', 'PRS68', 'Cánh cửa sổ 68', 0.772, 4],
  ['EU-55', 'EPV55', 'Phào viền vát cạnh', 0.637, 5],
  ['EU-55', 'E1283A', 'Khung chớp', 0.29, 10],
  ['EU-55', 'E192', 'Lá chớp', 0.317, 10],
  ['EU-TRUOT', 'PR5542', 'Khung cửa trượt', 0.78, 4],
  ['EU-TRUOT', 'PR2966', 'Cánh cửa trượt', 0.681, 4],
  ['EU-TRUOT', 'PR55M', 'Nẹp móc cửa trượt', 0.341, 10],
  ['EU-TRUOT', 'PR5512', 'Ray mỏng cửa lùa', 0.552, 5],
  ['EU-TRUOT', 'PR2990', 'Cánh cửa trượt 90', 0.954, 4],
  ['EU-TRUOT', 'PR55M90', 'Nẹp móc cửa trượt 90', 0.341, 10],
  ['EU-TRUOT', 'PR55N', 'Nẹp sập cửa bốn cánh', 0.258, 10],
  ['EU-TRUOT', 'C3300', 'Xập ghép khung', 0.348, 10],
  ['EU-TRUOT', 'C3326', 'Chuyển góc 90 độ', 1.051, 4],
  ['EU-TRUOT', 'C459', 'Thanh trượt đa điểm', 0.137, 10],
  ['EU-TRUOT', 'C3296', 'Sập kính', 0.237, 10],
  ['EU-TRUOT', 'C3225', 'Sập kính hộp', 0.211, 10],
  ['EU-TRUOT', 'T9801', 'Cánh trượt', 1.3991, 2],
  ['EU-TRUOT', 'T9802', 'Khung trượt', 1.3991, 2],
  ['EU-TRUOT', 'T9803', 'Ray dưới', 0.7135, 4],
  ['EU-TRUOT', 'T9804', 'Khung đơn', 0.6535, 4],
  ['EU-TRUOT', 'T9805', 'Ray đơn', 0.4396, 6],
  ['EU-TRUOT', 'T9806', 'Sập đối đầu', 0.2785, 10],
  ['EU-TRUOT', 'T9807', 'Sập U', 0.1956, 10],
  ['EU-TRUOT', 'T9808', 'Nẹp móc liền tay nắm', 1.0309, 2],
  ['EU-TRUOT', 'T9809', 'Nẹp kính', 0.2143, 10],
  ['EU-TRUOT', 'T9810', 'Nẹp kính hộp', 0.1799, 20],
  ['EU-70', 'KHK65', 'Khung phào mở quay ngoài', 1.12, 2],
  ['EU-70', 'E70-KA', 'Áo khung', 0.28, 10],
  ['EU-70', 'E70KT', 'Khung thấp E70', 0.72, 5],
  ['EU-70', 'E70KD', 'Khung đơn', 1.214, 4],
  ['EU-70', 'E701A', 'Khung liền phào', 1.385, 2],
  ['EU-70', 'E702', 'Nẹp phẳng', 0.096, 10],
  ['EU-70', 'E70D110', 'Cánh cửa đi 110', 1.963, 2],
  ['EU-70', 'E70S86', 'Cánh cửa sổ E70', 1.515, 2],
  ['EU-70', 'E70T98', 'Đố khung', 1.498, 2],
  ['EU-70', 'E704', 'Đố chia khung', 1.188, 4],
  ['EU-70', 'E705', 'Đố động', 1.045, 4],
  ['EU-70', 'E706', 'Nẹp chân cánh', 0.34, 10],
  ['EU-70', 'E707', 'Cánh cửa sổ', 1.692, 2],
  ['EU-70', 'E703', 'Cánh cửa đi', 2.152, 2],
  ['EU-70', 'E70D150', 'Cánh 150', 2.393, 1],
  ['EU-70', 'E70D190', 'Cánh 190', 2.91, 1],
  ['EU-70', 'E70NK', 'Nối khung', 0.373, 10],
  ['EU-70', 'E70SH', 'Sập kính thường', 0.266, 10],
  ['EU-TL', 'KTL01', 'Cánh 180', 3.06, 1],
  ['EU-TL', 'KTL03', 'Nẹp kính hộp', 0.23, 10],
  ['EU-TL', 'KTL07', 'Nẹp kính vuông', 0.364, 10],
  ['EU-TL', 'KTL04', 'Nẹp kính tròn', 0.364, 10],
  ['EU-TL', 'KTL05', 'Khung 200', 2.9, 1],
  ['EU-TL', 'KTL06', 'Đế sập', 0.377, 10],
  ['EU-TL', 'KTL08', 'Sập cánh kính hộp vuông', 0.301, 10],
  ['EU-TL', 'KTL09', 'Đế sập kính hộp', 0.417, 10],
  ['EU-TL', 'TL03', 'Khung thủy lực nhỏ', 1.858, 1],
  ['EU-TL', 'H50150', 'Hộp 50x150', 2.134, 1],
  ['EU-TL', 'D1409', 'Sập vách kính hộp', 0.377, 10],
  ['EU-TL', 'C101', 'Sập vách kính', 0.133, 10],
  ['EU-TL', 'KH01', 'Phào nóc', 0.7204, 4],
  ['EU-TL', 'KH02', 'Cánh', 0.638, 5],
  ['EU-TL', 'KH03', 'Pano phẳng 16', 0.7548, 5],
  ['EU-TL', 'KH04', 'Cột sau', 0.3121, 5],
  ['EU-TL', 'KH05', 'Khung vách', 0.3508, 5],
  ['EU-TL', 'KH06', 'Cột trước', 0.8165, 4],
  ['EU-TL', 'KH07', 'Đố chia vách', 0.2189, 10],
  ['EU-TL', 'KH08', 'Lá chớp', 0.4218, 5],
  ['EU-TL', 'KH09', 'U16', 0.1302, 10],
  ['EU-TL', 'KH10', 'Thanh ngang', 0.4974, 5],
  ['EU-TL', 'KH11', 'Cây ngăn kéo', 0.2051, 10],
  ['EU-TL', 'KH12', 'Phào nhỏ', 0.3034, 10],
  ['EU-TL', 'KH13', 'Cột trước nhỏ', 0.4841, 5],
  ['EU-TL', 'KH14', 'U8', 0.146, 10],
  ['EU-TL', 'KH16', 'Nan trang trí', 0.258, 20],
  ['EU-TL', 'KH17', 'Cánh nhỏ', 0.502, 5],
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

  await prisma.user.upsert({
    where: { email: 'tho@eurohouse.vn' }, update: {},
    create: { email: 'tho@eurohouse.vn', displayName: 'Thợ / Xưởng', passwordHash: 'demo', role: 'FACTORY', organizationId: factory.id },
  });
  await prisma.user.upsert({
    where: { email: 'board@eurohouse.vn' }, update: {},
    create: { email: 'board@eurohouse.vn', displayName: 'Quản trị Eurohouse', passwordHash: 'demo', role: 'ADMIN', organizationId: company.id },
  });
  await prisma.user.upsert({
    where: { email: 'npp@eurohouse.vn' }, update: {},
    create: { email: 'npp@eurohouse.vn', displayName: 'NPP Miền Nam', passwordHash: 'demo', role: 'NPP', organizationId: npp.id },
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

  // Xoá profile cũ, nạp 94 thanh thật
  await prisma.orderItem.deleteMany();
  await prisma.profile.deleteMany();
  for (const [sys, code, name, kg, bundle] of profiles) {
    await prisma.profile.create({
      data: {
        aluSystemId: systemIdByCode[sys], code, name, kgPerMeter: kg,
        barLengthMm: 5800, barsPerBundle: bundle, pricePerKg: 92000,
        imageUrl: `/static/profiles/${code}.png`,
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

  console.log(`Seed xong: ${aluSystems.length} hệ nhôm, ${profiles.length} thanh nhôm, ${colors.length} màu.`);
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
