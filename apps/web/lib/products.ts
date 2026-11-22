export type ProductSystem = {
  slug: string;
  name: string;
  family: 'Dòng sản phẩm' | 'Hệ chuyên dụng';
  code: string;
  eyebrow: string;
  summary: string;
  description: string;
  warranty: string;
  colors: string[];
  features: string[];
  applications: string[];
  image: string;
  profileImage: string;
};

export const products: ProductSystem[] = [
  {
    slug: 'ecento-70',
    name: 'ECENTO 70',
    family: 'Dòng sản phẩm',
    code: 'EU-70',
    eyebrow: 'Đa khoang cách âm, cách nhiệt',
    summary: 'Hệ nhôm kiến trúc cao cấp cho không gian cần độ kín khít và ổn định dài hạn.',
    description: 'ECENTO 70 sử dụng cấu trúc đa khoang và dải profile đồng bộ cho cửa mở quay, cửa sổ và các cấu hình kiến trúc cần khả năng cách âm, cách nhiệt tốt.',
    warranty: '15 năm',
    colors: ['Cafe Metallic', 'Xám ngọc trai', 'Vân gỗ Cẩm Lai', 'Vân gỗ Olack'],
    features: ['Cấu trúc đa khoang', 'Cánh cửa đến 190 mm', 'Nhiều lựa chọn nẹp kính', 'Đồng bộ cửa đi và cửa sổ'],
    applications: ['Biệt thự', 'Khách sạn', 'Nhà phố cao cấp', 'Công trình ven biển'],
    image: '/images/hero-eurohouse.png',
    profileImage: '/images/products/ecento-70.jpg',
  },
  {
    slug: 'ecento-plus',
    name: 'ECENTO PLUS',
    family: 'Dòng sản phẩm',
    code: 'EU-ECPLUS',
    eyebrow: 'Rãnh K Châu Âu, phẳng giấu vít',
    summary: 'Ngôn ngữ thiết kế phẳng, đồng bộ phụ kiện rãnh K và hoàn thiện tối giản.',
    description: 'ECENTO PLUS tập trung vào bề mặt phẳng, chi tiết liên phào và giải pháp giấu vít để tạo hình thức gọn, sang trọng cho cửa đi và cửa sổ hiện đại.',
    warranty: '15 năm; màu Olack 10 năm',
    colors: ['Cafe Metallic', 'Xám ngọc trai', 'Vân gỗ Cẩm Lai', 'Vân gỗ Olack'],
    features: ['Rãnh K Châu Âu', 'Bề mặt phẳng', 'Giải pháp liên phào', 'Dải cánh 78-138 mm'],
    applications: ['Biệt thự', 'Căn hộ cao cấp', 'Resort', 'Showroom'],
    image: '/images/factory/factory-5.jpg',
    profileImage: '/images/products/ecento-plus.jpg',
  },
  {
    slug: 'he-55-vat-canh',
    name: 'Hệ 55 Vát Cạnh',
    family: 'Dòng sản phẩm',
    code: 'EU-55',
    eyebrow: 'Phổ biến, kinh tế và bền bỉ',
    summary: 'Dòng profile vát cạnh cân bằng giữa thẩm mỹ, khả năng gia công và chi phí đầu tư.',
    description: 'Hệ 55 Vát Cạnh là lựa chọn thực dụng cho cửa đi, cửa sổ và vách kính dân dụng, với dải mã đồng bộ và quy trình sản xuất quen thuộc cho các xưởng nhôm kính.',
    warranty: '10 năm',
    colors: ['Cafe', 'Vân gỗ Olack'],
    features: ['Hệ 55 đồng bộ', 'Mặt vát nhận diện', 'Gia công thuận tiện', 'Phù hợp nhiều loại phụ kiện'],
    applications: ['Nhà phố', 'Công trình dân dụng', 'Trường học', 'Văn phòng'],
    image: '/images/factory/factory-2.jpg',
    profileImage: '/images/products/he-55-vat-canh.jpg',
  },
  {
    slug: 'preco',
    name: 'PRECO',
    family: 'Dòng sản phẩm',
    code: 'EU-PRECO',
    eyebrow: 'Tiêu chuẩn 55 đa năng',
    summary: 'Giải pháp profile tiêu chuẩn cho kiến trúc dân dụng và các dự án cần tối ưu ngân sách.',
    description: 'PRECO cung cấp dải hệ 55 đa năng, từ mặt cắt vát cạnh đến rãnh K, phù hợp các cấu hình cửa phổ biến và kế hoạch thi công cần kiểm soát chi phí.',
    warranty: '10 năm',
    colors: ['Xám ghi', 'Cafe', 'Trắng'],
    features: ['Độ dày định hướng 1 mm', 'Dễ triển khai', 'Dải mã phổ biến', 'Tối ưu chi phí'],
    applications: ['Nhà ở dân dụng', 'Nhà cho thuê', 'Công trình quy mô vừa', 'Cải tạo'],
    image: '/images/factory/factory-4.jpg',
    profileImage: '/images/products/preco.jpg',
  },
  {
    slug: 'cua-thuy-luc',
    name: 'Cửa Thủy Lực',
    family: 'Hệ chuyên dụng',
    code: 'EU-TL',
    eyebrow: 'Cánh 200 mm cho không gian đại sảnh',
    summary: 'Tỷ lệ profile lớn, tạo cảm giác vững chắc cho lối vào có quy mô và chiều cao lớn.',
    description: 'Hệ cửa thủy lực Eurohouse hướng đến đại sảnh, showroom và công trình cần hình khối mạnh, kết hợp cánh 200 mm cùng kính khổ lớn.',
    warranty: 'Theo màu và cấu hình',
    colors: ['Cafe Metallic', 'Cafe', 'Xám ngọc trai'],
    features: ['Cánh 200 mm', 'Tỷ lệ khung lớn', 'Phù hợp kính khổ lớn', 'Hình thức đại sảnh'],
    applications: ['Khách sạn', 'Showroom', 'Trụ sở', 'Biệt thự'],
    image: '/images/factory/factory-1.jpg',
    profileImage: '/images/products/thuy-luc.jpg',
  },
  {
    slug: 'truot-quay',
    name: 'Trượt Quay',
    family: 'Hệ chuyên dụng',
    code: 'EU-TQ',
    eyebrow: 'Hai cơ chế mở trong một hệ cửa',
    summary: 'Kết hợp trượt và quay để mở rộng khẩu độ mà không cần ray nổi dưới sàn.',
    description: 'Hệ trượt quay hỗ trợ các cấu hình mở trong và mở ngoài, cho phép gom cánh linh hoạt, phù hợp không gian kết nối phòng khách, sân vườn hoặc hiên.',
    warranty: 'Theo màu và cấu hình',
    colors: ['Cafe Metallic', 'Xám ngọc trai', 'Vân gỗ'],
    features: ['Không ray nổi dưới sàn', 'Cấu hình 2 và 4 cánh', 'Mở trong hoặc mở ngoài', 'Khẩu độ mở lớn'],
    applications: ['Biệt thự', 'Resort', 'Nhà vườn', 'Không gian thương mại'],
    image: '/images/hero-eurohouse.png',
    profileImage: '/images/products/truot-quay.jpg',
  },
  {
    slug: 'truot-chau-au',
    name: 'Trượt Châu Âu',
    family: 'Hệ chuyên dụng',
    code: 'EU-TRUOT',
    eyebrow: 'Panorama cho cánh kính khổ lớn',
    summary: 'Giải pháp trượt cao cấp cho tầm nhìn rộng, vận hành êm và tải trọng cánh lớn.',
    description: 'Hệ trượt Châu Âu được phát triển cho các bộ cửa panorama, ưu tiên khẩu độ kính, độ ổn định và chuyển động êm trong không gian cao cấp.',
    warranty: 'Theo màu và cấu hình',
    colors: ['Cafe Metallic', 'Xám ngọc trai'],
    features: ['Tải trọng thiết kế đến 400 kg/cánh', 'Tầm nhìn panorama', 'Ray trượt đồng bộ', 'Khung cánh vững chắc'],
    applications: ['Villa', 'Penthouse', 'Resort', 'Khách sạn'],
    image: '/images/factory/factory-5.jpg',
    profileImage: '/images/products/truot-chau-au.jpg',
  },
  {
    slug: 'mat-dung',
    name: 'Mặt Dựng',
    family: 'Hệ chuyên dụng',
    code: 'EU-MD',
    eyebrow: 'Giải pháp bao che công trình',
    summary: 'Dải profile mặt dựng cho văn phòng, showroom và công trình quy mô lớn.',
    description: 'Hệ mặt dựng Eurohouse tổ chức khung đứng, ngang và nẹp đồng bộ, phục vụ thiết kế mặt đứng kính cần khả năng chịu tải gió và kiểm soát kín nước.',
    warranty: 'Theo màu và cấu hình',
    colors: ['Cafe Metallic', 'Xám ngọc trai'],
    features: ['Hệ khung đồng bộ', 'Thiết kế theo tải gió dự án', 'Nẹp và phụ kiện chuyên dụng', 'Hỗ trợ hồ sơ kỹ thuật'],
    applications: ['Văn phòng', 'Trung tâm thương mại', 'Showroom', 'Nhà ga'],
    image: '/images/factory/factory-3.jpg',
    profileImage: '/images/products/mat-dung.jpg',
  },
  {
    slug: 'noi-that-canh-kinh',
    name: 'Nội Thất Cánh Kính',
    family: 'Hệ chuyên dụng',
    code: 'EU-NOITHAT',
    eyebrow: 'Profile thanh mảnh cho nội thất',
    summary: 'Khung cánh kính gọn cho tủ áo, tủ bếp, vách trang trí và không gian trưng bày.',
    description: 'Dải nhôm nội thất tập trung vào tỷ lệ thanh mảnh, bề mặt hoàn thiện đồng nhất và khả năng kết hợp kính trong nhiều không gian sử dụng.',
    warranty: 'Theo màu và cấu hình',
    colors: ['Cafe', 'Đen', 'Xám'],
    features: ['Mặt profile thanh mảnh', 'Đồng bộ cánh kính', 'Nhiều cấu hình tay nắm', 'Ứng dụng linh hoạt'],
    applications: ['Tủ bếp', 'Tủ áo', 'Showroom', 'Vách trang trí'],
    image: '/images/factory/factory-2.jpg',
    profileImage: '/images/products/noi-that.jpg',
  },
  {
    slug: 'chan-song-bao-ve',
    name: 'Chấn Song Bảo Vệ',
    family: 'Hệ chuyên dụng',
    code: 'EU-CS',
    eyebrow: 'Bảo vệ tích hợp trong hệ khung',
    summary: 'Giải pháp chấn song đồng bộ hình thức, hạn chế các chi tiết lắp ghép rời rạc.',
    description: 'Hệ chấn song Eurohouse cho phép tổ chức thanh bảo vệ cùng cấu trúc khung, giúp mặt đứng gọn và thuận tiện hơn trong thi công cửa sổ, ban công.',
    warranty: 'Theo màu và cấu hình',
    colors: ['Cafe', 'Xám', 'Vân gỗ'],
    features: ['Đồng bộ hệ khung', 'Liên kết chắc chắn', 'Hình thức thống nhất', 'Dễ bảo trì'],
    applications: ['Cửa sổ', 'Ban công', 'Nhà phố', 'Trường học'],
    image: '/images/factory/factory-4.jpg',
    profileImage: '/images/products/chan-song.jpg',
  },
];

export const strategicProducts = products.filter((product) => product.family === 'Dòng sản phẩm');
export const specialistProducts = products.filter((product) => product.family === 'Hệ chuyên dụng');

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}
