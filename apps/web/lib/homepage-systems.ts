/**
 * Nội dung hệ nhôm cho trang chủ (hướng A · Catalogue mặt cắt, duyệt 20/11/2026).
 * Mã profile, độ dày, kg/m và số mã lấy từ catalog r19 (apps/api/prisma/catalog-r19-snapshot.json);
 * homepage-systems.test.ts đối chiếu lại với snapshot đó.
 */

export type HomeProfileSpec = {
  code: string;
  name: string;
  thicknessMm: string;
  kgPerMeter: number;
  image: string;
};

export type HomeMainSystem = {
  slug: string;
  name: string;
  code: string;
  tagline: string;
  summary: string;
  description: string;
  image: string;
  imageAlt: string;
  /** contain: ảnh tách nền trắng; cover: ảnh có bối cảnh, phủ kín khung */
  imageFit: 'contain' | 'cover';
  href: string;
  warranty: string;
  colors: string[];
  features: string[];
  suitableFor: string[];
  benefits: string[];
  bestFor: string;
  profile: HomeProfileSpec;
  catalog: { profileCount: number; thicknessMin: number; thicknessMax: number };
};

export type HomeSpecialistSystem = {
  slug: string;
  name: string;
  code: string;
  tagline: string;
  summary: string;
  features: string[];
  applications: string[];
  href: string;
  profile: HomeProfileSpec;
  catalog: { profileCount: number };
};

export const homeMainSystems: HomeMainSystem[] = [
  {
    slug: 'ecento-70',
    name: 'ECENTO 70',
    code: 'EU-70',
    tagline: 'Đa khoang, cách âm và cách nhiệt',
    summary: 'Hệ nhôm kiến trúc cao cấp cho không gian cần độ kín khít và ổn định dài hạn.',
    description: 'ECENTO 70 là hệ nhôm đa khoang cho cửa đi, cửa sổ và vách kính ở công trình ưu tiên cảm giác kín khít, yên tĩnh và ổn định khi sử dụng lâu dài. Dải profile đồng bộ cho cửa mở quay, cửa sổ và các cấu hình kiến trúc cần cách âm, cách nhiệt tốt.',
    image: '/images/gallery/ecento-70-mat-cat.webp',
    imageAlt: 'Mặt cắt thực tế thanh ECENTO 70 phủ vân gỗ',
    imageFit: 'contain',
    href: '/nhom-dan-dung/dong-san-pham/ecento-70',
    warranty: '15 năm',
    colors: ['Cafe Metallic', 'Xám ngọc trai', 'Vân gỗ Cẩm Lai', 'Vân gỗ Olack'],
    features: ['Cấu trúc đa khoang', 'Cánh cửa đến 190 mm', 'Nhiều lựa chọn nẹp kính', 'Đồng bộ cửa đi và cửa sổ'],
    suitableFor: ['Biệt thự, nhà phố ở khu vực nhiều tiếng ồn', 'Phòng ngủ, phòng làm việc dùng điều hòa thường xuyên', 'Công trình muốn đồng bộ cửa đi, cửa sổ và vách kính'],
    benefits: ['Cấu trúc đa khoang hỗ trợ cách âm, cách nhiệt', 'Nhiều kiểu cửa trong cùng một ngôn ngữ thiết kế', 'Tỷ lệ khung chắc chắn hợp kiến trúc cao cấp'],
    bestFor: 'Kín khít, yên tĩnh',
    profile: { code: 'E701A', name: 'Khung liền phào', thicknessMm: '1.6', kgPerMeter: 1.385, image: '/images/profiles/E701A.png' },
    catalog: { profileCount: 20, thicknessMin: 1, thicknessMax: 2 },
  },
  {
    slug: 'ecento-plus',
    name: 'ECENTO PLUS',
    code: 'EU-ECPLUS',
    tagline: 'Rãnh K châu Âu, phẳng và giấu vít',
    summary: 'Ngôn ngữ thiết kế phẳng, đồng bộ phụ kiện rãnh K và hoàn thiện tối giản.',
    description: 'ECENTO PLUS hướng đến bề mặt cửa phẳng, chi tiết liên phào và giải pháp giấu vít, tạo hình thức gọn và sang cho cửa đi, cửa sổ hiện đại. Rãnh K châu Âu giúp thợ chọn phụ kiện đồng bộ theo một hệ quy chiếu.',
    image: '/images/gallery/ecento-plus-mat-cat.webp',
    imageAlt: 'Nhân viên EUROHOUSE cầm mẫu mặt cắt ECENTO PLUS màu xám',
    imageFit: 'cover',
    href: '/nhom-dan-dung/dong-san-pham/ecento-plus',
    warranty: '15 năm (màu Olack 10 năm)',
    colors: ['Cafe Metallic', 'Xám ngọc trai', 'Vân gỗ Cẩm Lai', 'Vân gỗ Olack'],
    features: ['Rãnh K châu Âu', 'Bề mặt phẳng', 'Giải pháp liên phào', 'Dải cánh 78–138 mm'],
    suitableFor: ['Biệt thự và căn hộ thiết kế tối giản', 'Cửa đi, cửa sổ cần bề mặt liền mạch', 'Công trình muốn giảm vít lộ và chi tiết thừa'],
    benefits: ['Hình thức phẳng, tinh gọn', 'Phụ kiện rãnh K tổ chức theo một chuẩn', 'Dễ phối với nội thất và mặt đứng hiện đại'],
    bestFor: 'Phẳng, tối giản',
    profile: { code: 'C3328P', name: 'Khung liền phào', thicknessMm: '1.3', kgPerMeter: 1.179, image: '/images/profiles/C3328P.png' },
    catalog: { profileCount: 24, thicknessMin: 1, thicknessMax: 2 },
  },
  {
    slug: 'he-55-vat-canh',
    name: 'HỆ 55 VÁT CẠNH',
    code: 'EU-55',
    tagline: 'Phổ biến, kinh tế và bền bỉ',
    summary: 'Dòng profile vát cạnh cân bằng giữa thẩm mỹ, khả năng gia công và chi phí đầu tư.',
    description: 'Hệ 55 Vát Cạnh là lựa chọn quen thuộc cho cửa dân dụng: mặt profile vát tạo đường nét rõ cho bộ cửa, dải mã đồng bộ cho cửa đi, cửa sổ và vách kính, quy trình gia công quen tay với nhiều xưởng nhôm kính.',
    image: '/images/gallery/he-55-mat-cat.webp',
    imageAlt: 'Mẫu góc profile hệ 55 vát cạnh phủ vân gỗ',
    imageFit: 'cover',
    href: '/nhom-dan-dung/dong-san-pham/he-55-vat-canh',
    warranty: '10 năm',
    colors: ['Cafe', 'Vân gỗ Olack'],
    features: ['Hệ 55 đồng bộ', 'Mặt vát nhận diện', 'Gia công thuận tiện', 'Hợp nhiều loại phụ kiện'],
    suitableFor: ['Nhà phố, văn phòng, công trình dân dụng', 'Dự án cân bằng thẩm mỹ với ngân sách', 'Cửa đi, cửa sổ theo cấu hình phổ biến'],
    benefits: ['Mặt vát tạo đường nét rõ', 'Dải ứng dụng rộng trong dân dụng', 'Xưởng nhôm kính quen quy trình gia công'],
    bestFor: 'Cân bằng, dễ làm',
    profile: { code: 'LH5110', name: 'Khung bao VIP', thicknessMm: '1.3', kgPerMeter: 1.387, image: '/images/profiles/LH5110.png' },
    catalog: { profileCount: 28, thicknessMin: 0.7, thicknessMax: 2.2 },
  },
  {
    slug: 'preco',
    name: 'PRECO',
    code: 'EU-PRECO',
    tagline: 'Tiêu chuẩn 55 đa năng',
    summary: 'Giải pháp profile tiêu chuẩn cho kiến trúc dân dụng và dự án cần tối ưu ngân sách.',
    description: 'PRECO là dải hệ 55 đa năng, từ mặt cắt vát cạnh đến rãnh K, cho các cấu hình cửa phổ biến. Phù hợp công trình cần một hệ dễ tiếp cận, dễ tổ chức sản xuất và kiểm soát chi phí ngay từ đầu.',
    image: '/images/gallery/preco-mat-cat.webp',
    imageAlt: 'Mặt cắt thực tế khung cánh hệ PRECO màu xám',
    imageFit: 'contain',
    href: '/nhom-dan-dung/dong-san-pham/preco',
    warranty: '5 năm',
    colors: ['Xám ghi', 'Cafe', 'Trắng'],
    features: ['Độ dày định hướng 1 mm', 'Dễ triển khai', 'Dải mã phổ biến', 'Tối ưu chi phí'],
    suitableFor: ['Nhà ở, công trình cải tạo, dự án quy mô vừa', 'Cửa đi, cửa sổ cấu hình thông dụng', 'Chủ đầu tư cần kiểm soát chi phí'],
    benefits: ['Dải mã cho nhu cầu dân dụng thiết yếu', 'Lập phương án nhanh cho công trình vừa', 'Cân bằng công năng với chi phí'],
    bestFor: 'Tối ưu ngân sách',
    profile: { code: 'PRK55', name: 'Khung PRK55', thicknessMm: '0.9', kgPerMeter: 0.65, image: '/images/profiles/PRK55.png' },
    catalog: { profileCount: 34, thicknessMin: 0.7, thicknessMax: 2.2 },
  },
];

export const homeSpecialistSystems: HomeSpecialistSystem[] = [
  {
    slug: 'cua-thuy-luc',
    name: 'Cửa thủy lực',
    code: 'EU-TL',
    tagline: 'Cánh 200 mm cho đại sảnh',
    summary: 'Tỷ lệ profile lớn, kính khổ lớn, tạo lối vào vững chãi cho công trình có chiều cao.',
    features: ['Khung bao 200 mm', 'Hợp kính khổ lớn', 'Hình khối đại sảnh'],
    applications: ['Khách sạn', 'Showroom', 'Trụ sở', 'Biệt thự'],
    href: '/nhom-dan-dung/he-chuyen-dung/cua-thuy-luc',
    profile: { code: 'KTL-05', name: 'Khung bao 200', thicknessMm: '2.0', kgPerMeter: 3.37, image: '/images/profiles/KTL-05.png' },
    catalog: { profileCount: 10 },
  },
  {
    slug: 'truot-quay',
    name: 'Trượt quay',
    code: 'EU-TQ',
    tagline: 'Hai cơ chế mở trong một bộ cửa',
    summary: 'Kết hợp trượt và quay để mở rộng khẩu độ mà không cần ray nổi dưới sàn.',
    features: ['Không ray nổi dưới sàn', 'Cấu hình 2 và 4 cánh', 'Mở trong hoặc mở ngoài'],
    applications: ['Biệt thự', 'Resort', 'Nhà vườn'],
    href: '/nhom-dan-dung/he-chuyen-dung/truot-quay',
    profile: { code: 'KH-TQ04', name: 'Cánh trên', thicknessMm: '1.7', kgPerMeter: 1.422, image: '/images/profiles/KH-TQ04.png' },
    catalog: { profileCount: 12 },
  },
  {
    slug: 'truot-chau-au',
    name: 'Trượt châu Âu',
    code: 'EU-TRUOT',
    tagline: 'Panorama cho cánh kính khổ lớn',
    summary: 'Hệ trượt cho tầm nhìn rộng, vận hành êm và tải trọng cánh lớn.',
    features: ['Tải thiết kế đến 400 kg/cánh', 'Ray trượt đồng bộ', 'Khung cánh vững chắc'],
    applications: ['Villa', 'Penthouse', 'Khách sạn'],
    href: '/nhom-dan-dung/he-chuyen-dung/truot-chau-au',
    profile: { code: 'KH-T9802', name: 'Khung', thicknessMm: '1.5', kgPerMeter: 1.43, image: '/images/profiles/KH-T9802.png' },
    catalog: { profileCount: 14 },
  },
  {
    slug: 'mat-dung',
    name: 'Mặt dựng',
    code: 'EU-MD',
    tagline: 'Bao che mặt đứng kính',
    summary: 'Khung đứng, ngang và nẹp đồng bộ cho văn phòng, showroom và công trình lớn.',
    features: ['Khung 65×77 đến 65×120', 'Thiết kế theo tải gió dự án', 'Hỗ trợ hồ sơ kỹ thuật'],
    applications: ['Văn phòng', 'Trung tâm thương mại', 'Showroom'],
    href: '/nhom-dan-dung/he-chuyen-dung/mat-dung',
    profile: { code: 'EMD6577', name: 'Khung mặt dựng 65x77', thicknessMm: '2.0', kgPerMeter: 1.615, image: '/images/profiles/EMD6577.png' },
    catalog: { profileCount: 6 },
  },
  {
    slug: 'noi-that-canh-kinh',
    name: 'Nội thất cánh kính',
    code: 'EU-NOITHAT',
    tagline: 'Profile thanh mảnh cho nội thất',
    summary: 'Khung cánh kính gọn cho tủ áo, tủ bếp, vách trang trí và không gian trưng bày.',
    features: ['Mặt profile thanh mảnh', 'Đồng bộ cánh kính', 'Nhiều cấu hình tay nắm'],
    applications: ['Tủ bếp', 'Tủ áo', 'Vách trang trí'],
    href: '/nhom-dan-dung/he-chuyen-dung/noi-that-canh-kinh',
    profile: { code: 'KH05', name: 'Khung vách', thicknessMm: '0.8', kgPerMeter: 0.351, image: '/images/profiles/KH05.png' },
    catalog: { profileCount: 17 },
  },
  {
    slug: 'chan-song-bao-ve',
    name: 'Chấn song bảo vệ',
    code: 'EU-CS',
    tagline: 'Bảo vệ tích hợp trong hệ khung',
    summary: 'Thanh bảo vệ đi cùng cấu trúc khung, mặt đứng gọn và dễ thi công.',
    features: ['Đồng bộ hệ 55 và ECENTO 70', 'Liên kết chắc chắn', 'Dễ bảo trì'],
    applications: ['Cửa sổ', 'Ban công', 'Trường học'],
    href: '/nhom-dan-dung/he-chuyen-dung/chan-song-bao-ve',
    profile: { code: 'ECS01', name: 'Khung chấn song hệ 55', thicknessMm: '1.3', kgPerMeter: 1.391, image: '/images/profiles/ECS01.png' },
    catalog: { profileCount: 22 },
  },
];

export const homeIndustrialServices = [
  { title: 'Nhôm định hình theo bản vẽ', text: 'Profile riêng cho thiết bị, khung máy và sản phẩm OEM, từ bản vẽ hoặc mẫu thật.', href: '/nhom-cong-nghiep/dinh-hinh-theo-ban-ve' },
  { title: 'Chi tiết máy và linh kiện', text: 'Thanh nhôm và chi tiết cần dung sai rõ ràng cho dây chuyền, máy móc.', href: '/nhom-cong-nghiep/chi-tiet-may' },
  { title: 'Nhôm cho hệ năng lượng mặt trời', text: 'Khung tấm pin, ray và giá đỡ cho dự án điện mặt trời áp mái và mặt đất.', href: '/nhom-cong-nghiep/nang-luong-mat-troi' },
  { title: 'Nhận đùn profile theo yêu cầu', text: 'Đùn thuê theo khuôn có sẵn hoặc phát triển khuôn mới cùng kỹ sư EUROHOUSE.', href: '/nhom-cong-nghiep/dun-thue' },
  { title: 'Gia công sản phẩm nhôm', text: 'Cắt, khoan, đột, hoàn thiện bề mặt để giao chi tiết sẵn lắp ráp.', href: '/nhom-cong-nghiep/gia-cong' },
] as const;

export const homeProcessSteps = [
  { title: 'Phôi và đùn ép', text: 'Phôi nhôm đúc được gia nhiệt và đùn qua khuôn thành profile theo từng hệ.', image: '/images/gallery/phoi-nhom.webp', alt: 'Phôi nhôm tròn chờ đùn ép tại nhà máy EUROHOUSE' },
  { title: 'Sơn tĩnh điện', text: 'Dây chuyền sơn cho dải màu Cafe Metallic, xám ngọc trai, trắng, xám ghi.', image: '/images/gallery/day-chuyen-son.webp', alt: 'Dây chuyền sơn tĩnh điện profile nhôm tại nhà máy EUROHOUSE' },
  { title: 'Vân gỗ', text: 'Bề mặt vân gỗ Cẩm Lai, Olack cho cửa nhà ở cần cảm giác ấm.', image: '/images/gallery/van-go-oleck.webp', alt: 'Mẫu góc profile nhôm vân gỗ Oleck Bắc Âu' },
  { title: 'Mẫu và tư vấn', text: 'Mẫu màu, mẫu mặt cắt và catalog cho thợ, kiến trúc sư, nhà phân phối.', image: '/images/v4/wood-finish-staff.jpg', alt: 'Nhân viên EUROHOUSE giới thiệu mẫu profile vân gỗ' },
] as const;
