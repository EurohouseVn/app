export type ResidentialItem = {
  slug: string;
  title: string;
  code?: string;
  eyebrow: string;
  summary: string;
  description: string;
  image?: string;
  applications: string[];
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
  return { slug, title, code, eyebrow, summary, description: `${summary} Thông số và cấu hình được xác nhận theo tài liệu kỹ thuật hiện hành của EUROHOUSE.`, image, applications, category };
}
function solution(slug: string, title: string, summary: string): ResidentialItem {
  return { slug, title, eyebrow: 'Giải pháp theo công trình', summary, description: `${summary} EUROHOUSE tiếp nhận yêu cầu để đề xuất hệ nhôm và tài liệu phù hợp.`, image: '/images/v5/project-villa.webp', applications: [title], category: 'solution' };
}
