import type { IndustrialSearchItem, IndustrialServiceSlug } from './industrial-query';

export type IndustrialService = IndustrialSearchItem & {
  eyebrow: string;
  description: string;
  image: string;
  deliverables: string[];
};

export const industrialServices: IndustrialService[] = [
  service('dinh-hinh-theo-ban-ve', 'Định hình theo bản vẽ', 'Tiếp nhận hồ sơ profile để đánh giá khả năng đùn và phương án triển khai.', ['Kiến trúc', 'Cơ khí', 'Thiết bị'], ['Đánh giá hình học profile', 'Phản hồi yêu cầu bổ sung', 'Xác nhận phương án kỹ thuật']),
  service('chi-tiet-may', 'Chi tiết máy', 'Profile nhôm cho cụm máy, thiết bị và kết cấu kỹ thuật theo hồ sơ.', ['Cơ khí', 'Máy móc', 'Tự động hóa'], ['Đọc yêu cầu ứng dụng', 'Rà soát bản vẽ', 'Liên hệ xác nhận kỹ thuật']),
  service('nang-luong-mat-troi', 'Nhôm năng lượng mặt trời', 'Profile nhôm phục vụ kết cấu và hệ giá đỡ trong các ứng dụng năng lượng.', ['Năng lượng', 'Kết cấu'], ['Tiếp nhận yêu cầu tải và lắp đặt', 'Rà soát môi trường sử dụng', 'Đề xuất bước xác nhận tiếp theo']),
  service('dun-thue', 'Đùn thuê profile nhôm', 'Dịch vụ đùn theo hồ sơ kỹ thuật và kế hoạch sản lượng của khách hàng.', ['Sản xuất', 'OEM', 'Cơ khí'], ['Đánh giá hồ sơ', 'Xác nhận điều kiện triển khai', 'Lập đầu mối kỹ thuật']),
  service('gia-cong', 'Gia công sản phẩm nhôm', 'Kết nối nhu cầu sau đùn theo yêu cầu cụ thể của sản phẩm.', ['Gia công', 'Thành phẩm', 'OEM'], ['Tiếp nhận tiêu chuẩn đầu ra', 'Xác định công đoạn cần thiết', 'Xác nhận phạm vi thực hiện']),
];

export const industrialApplications = [...new Set(industrialServices.flatMap((item) => item.applications))].sort((a, b) => a.localeCompare(b, 'vi'));
export const getIndustrialService = (slug: string) => industrialServices.find((item) => item.slug === slug);

function service(slug: IndustrialServiceSlug, title: string, summary: string, applications: string[], deliverables: string[]): IndustrialService {
  return { slug, title, summary, applications, deliverables, eyebrow: 'Dịch vụ nhôm công nghiệp', description: `${summary} Thông số vật liệu, dung sai, bề mặt, sản lượng tối thiểu và tiến độ được xác nhận riêng theo từng hồ sơ.`, image: '/images/v5/factory-coating.webp' };
}
