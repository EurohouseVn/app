export type ResidentialItem = {
  slug: string;
  title: string;
  code?: string;
  eyebrow: string;
  summary: string;
  description: string;
  image?: string;
  applications: string[];
  suitableFor: string[];
  benefits: string[];
  selectionNotes: string[];
  relatedLinks: Array<{ label: string; href: string }>;
  category: 'product' | 'specialist' | 'solution';
};

export const residentialProducts: ResidentialItem[] = [
  item('ecento-70', 'ECENTO 70', 'EU-70', 'Dòng nhôm kiến trúc', 'Hệ nhôm đa khoang dành cho không gian cần nâng cao cách âm và cách nhiệt.', '/images/v5/product-ecento-70.webp', ['Cửa đi', 'Cửa sổ', 'Vách kính'], 'product'),
  item('ecento-plus', 'ECENTO PLUS', 'EU-ECPLUS', 'Dòng nhôm kiến trúc', 'Giải pháp rãnh K Châu Âu với thiết kế phẳng và cấu hình giấu vít.', '/images/v5/product-ecento-plus.webp', ['Nhà ở', 'Biệt thự', 'Công trình cao cấp'], 'product'),
  item('he-55-vat-canh', 'HỆ 55 VÁT CẠNH', 'EU-55', 'Dòng nhôm kiến trúc', 'Hệ nhôm cân bằng giữa thẩm mỹ, công năng và khả năng triển khai.', '/images/v5/product-he-55.webp', ['Nhà phố', 'Văn phòng', 'Công trình dân dụng'], 'product'),
  item('preco', 'PRECO', 'EU-PRECO', 'Dòng nhôm kiến trúc', 'Giải pháp hệ 55 đa năng cho các cấu hình cửa phổ biến.', '/images/v5/product-preco.webp', ['Nhà ở', 'Cải tạo', 'Công trình quy mô vừa'], 'product'),
];

export const specialistSystems: ResidentialItem[] = [
  item('cua-thuy-luc', 'Cửa thủy lực', 'EU-TL', 'Hệ chuyên dụng', 'Giải pháp cửa cho đại sảnh, showroom và không gian cần hình khối vững chắc.', '/images/products/thuy-luc.jpg', ['Đại sảnh', 'Showroom', 'Biệt thự'], 'specialist'),
  item('truot-quay', 'Trượt quay', 'EU-TQ', 'Hệ chuyên dụng', 'Kết hợp cơ chế trượt và quay cho nhu cầu mở rộng khẩu độ.', '/images/products/truot-quay.jpg', ['Nhà vườn', 'Resort', 'Không gian thương mại'], 'specialist'),
  item('truot-chau-au', 'Trượt Châu Âu', 'EU-TRUOT', 'Hệ chuyên dụng', 'Giải pháp trượt cho cánh kính khổ lớn và tầm nhìn rộng.', '/images/products/truot-chau-au.jpg', ['Villa', 'Penthouse', 'Khách sạn'], 'specialist'),
  item('mat-dung', 'Mặt dựng', 'EU-MD', 'Hệ chuyên dụng', 'Giải pháp khung nhôm cho mặt đứng kính công trình.', '/images/products/mat-dung.jpg', ['Văn phòng', 'Showroom', 'Thương mại'], 'specialist'),
  item('noi-that-canh-kinh', 'Nội thất cánh kính', 'EU-NOITHAT', 'Hệ chuyên dụng', 'Profile thanh mảnh cho tủ, vách trang trí và không gian trưng bày.', '/images/products/noi-that.jpg', ['Tủ bếp', 'Tủ áo', 'Vách trang trí'], 'specialist'),
  item('chan-song-bao-ve', 'Chấn song bảo vệ', 'EU-CS', 'Hệ chuyên dụng', 'Giải pháp bảo vệ được tổ chức đồng bộ cùng hệ khung.', '/images/products/chan-song.jpg', ['Cửa sổ', 'Ban công', 'Trường học'], 'specialist'),
];

export const residentialSolutions: ResidentialItem[] = [
  solution('biet-thu-nha-pho', 'Biệt thự và nhà phố', 'Tổ chức hệ cửa, bề mặt và cấu hình phù hợp ngôn ngữ kiến trúc nhà ở.'),
  solution('chung-cu-khu-do-thi', 'Chung cư và khu đô thị', 'Giải pháp đồng bộ theo yêu cầu thiết kế và hồ sơ dự án.'),
  solution('khach-san-nghi-duong', 'Khách sạn và nghỉ dưỡng', 'Phối hợp hệ cửa và bề mặt cho không gian lưu trú.'),
  solution('van-phong-thuong-mai', 'Văn phòng và thương mại', 'Hệ nhôm cho mặt đứng, cửa và không gian thương mại.'),
  solution('cong-trinh-cong-cong', 'Trường học, bệnh viện và công trình công cộng', 'Giải pháp theo yêu cầu vận hành và hồ sơ kỹ thuật của công trình.'),
];

export const allResidentialItems = [...residentialProducts, ...specialistSystems, ...residentialSolutions];
export const getResidentialItem = (slug: string, category?: ResidentialItem['category']) => allResidentialItems.find((entry) => entry.slug === slug && (!category || entry.category === category));

function item(slug: string, title: string, code: string, eyebrow: string, summary: string, image: string, applications: string[], category: ResidentialItem['category']): ResidentialItem {
  const guidance = productGuidanceFor(slug) ?? {
    description: `${summary} Hãy đối chiếu kiểu mở, kích thước ô chờ và ngôn ngữ kiến trúc trước khi chọn cấu hình.`,
    suitableFor: applications,
    benefits: ['Tổ chức profile đồng bộ theo ứng dụng', 'Có tuyến tài liệu và tư vấn riêng', 'Dễ đối chiếu với nhu cầu công trình'],
    selectionNotes: ['Xác định kiểu mở và kích thước ô cửa', 'Trao đổi phụ kiện, kính và bề mặt mong muốn'],
  };
  return { ...guidance, slug, title, code, eyebrow, summary, image, applications, category, relatedLinks: [{ label: 'Xem catalog sản phẩm', href: '/tai-nguyen/catalog' }, { label: 'Nhận tư vấn lựa chọn hệ', href: `/lien-he?san-pham=${slug}` }, { label: 'So sánh các hệ nhôm', href: '/nhom-dan-dung/so-sanh' }] };
}
function solution(slug: string, title: string, summary: string): ResidentialItem {
  return { slug, title, eyebrow: 'Giải pháp theo công trình', summary, description: `${summary} Việc lựa chọn bắt đầu từ vị trí ô cửa, kiểu mở, tần suất sử dụng và yêu cầu thẩm mỹ của dự án.`, image: '/images/v5/project-villa.webp', applications: [title], suitableFor: [title, 'Đơn vị thiết kế và thi công cần định hướng hệ'], benefits: ['Gắn lựa chọn hệ với bối cảnh công trình', 'Phối hợp cửa, mặt dựng và bề mặt nhất quán', 'Có đầu mối tư vấn từ nhu cầu đến tài liệu'], selectionNotes: ['Chuẩn bị mặt bằng, mặt đứng hoặc ảnh hiện trạng', 'Nêu rõ kiểu mở, màu sắc và mốc tiến độ mong muốn'], relatedLinks: [{ label: 'Xem catalog sản phẩm', href: '/tai-nguyen/catalog' }, { label: 'Gửi nhu cầu công trình', href: '/lien-he' }], category: 'solution' };
}

function productGuidanceFor(slug: string): Pick<ResidentialItem, 'description' | 'suitableFor' | 'benefits' | 'selectionNotes'> | undefined {
  const guidance: Record<string, Pick<ResidentialItem, 'description' | 'suitableFor' | 'benefits' | 'selectionNotes'>> = {
  'ecento-70': {
    description: 'ECENTO 70 là hệ nhôm đa khoang cho cửa đi, cửa sổ và vách kính ở công trình ưu tiên cảm giác kín khít, yên tĩnh và ổn định khi sử dụng lâu dài.',
    suitableFor: ['Biệt thự, nhà phố ở khu vực nhiều tiếng ồn', 'Phòng ngủ, phòng làm việc và không gian dùng điều hòa thường xuyên', 'Công trình muốn đồng bộ cửa đi, cửa sổ và vách kính'],
    benefits: ['Cấu trúc đa khoang hỗ trợ mục tiêu cách âm và cách nhiệt', 'Dải profile phục vụ nhiều kiểu cửa trong cùng ngôn ngữ thiết kế', 'Tỷ lệ khung chắc chắn phù hợp kiến trúc cao cấp'],
    selectionNotes: ['Ưu tiên khi công trình đặt nặng độ kín khít và tiện nghi', 'Cần phối hợp đúng kính, gioăng, phụ kiện và biện pháp lắp đặt để đạt hiệu quả tổng thể'],
  },
  'ecento-plus': {
    description: 'ECENTO PLUS hướng đến bề mặt cửa phẳng, chi tiết gọn và khả năng phối hợp phụ kiện rãnh K cho những không gian theo phong cách hiện đại.',
    suitableFor: ['Biệt thự và căn hộ có thiết kế tối giản', 'Cửa đi, cửa sổ cần bề mặt liền mạch', 'Công trình muốn giảm cảm giác lộ vít và chi tiết thừa'],
    benefits: ['Hình thức phẳng tạo cảm giác tinh gọn', 'Rãnh K giúp tổ chức phụ kiện theo một hệ quy chiếu', 'Dễ phối hợp với nội thất và mặt đứng hiện đại'],
    selectionNotes: ['Chọn khi thẩm mỹ phẳng và chi tiết hoàn thiện là ưu tiên', 'Đối chiếu bộ phụ kiện, kiểu mở và giải pháp liên phào ngay từ thiết kế'],
  },
  'he-55-vat-canh': {
    description: 'Hệ 55 Vát Cạnh là lựa chọn quen thuộc cho cửa dân dụng, tạo điểm nhận diện bằng mặt profile vát và thuận tiện cho nhiều xưởng nhôm kính triển khai.',
    suitableFor: ['Nhà phố, văn phòng và công trình dân dụng', 'Dự án cần cân bằng thẩm mỹ với ngân sách', 'Cấu hình cửa đi và cửa sổ phổ biến'],
    benefits: ['Mặt vát tạo đường nét rõ cho bộ cửa', 'Dải ứng dụng rộng trong công trình dân dụng', 'Quy trình gia công quen thuộc với nhiều cơ sở sản xuất'],
    selectionNotes: ['Phù hợp khi cần một hệ linh hoạt cho nhiều loại cửa', 'Nên chốt màu, kính và phụ kiện đồng bộ trước khi sản xuất'],
  },
  preco: {
    description: 'PRECO tập trung vào các cấu hình cửa phổ biến và bài toán ngân sách, phù hợp công trình cần một hệ 55 đa năng, dễ tiếp cận và dễ tổ chức sản xuất.',
    suitableFor: ['Nhà ở, công trình cải tạo và dự án quy mô vừa', 'Cửa đi, cửa sổ theo cấu hình thông dụng', 'Chủ đầu tư muốn kiểm soát chi phí từ đầu'],
    benefits: ['Dải mã phục vụ nhu cầu dân dụng thiết yếu', 'Thuận tiện lập phương án cho công trình quy mô vừa', 'Cân bằng công năng sử dụng với chi phí đầu tư'],
    selectionNotes: ['Ưu tiên khi cấu hình phổ biến và ngân sách là tiêu chí chính', 'Cần đối chiếu kích thước, kiểu mở và tài liệu hệ trước khi bóc tách'],
  },
  };
  return guidance[slug];
}
