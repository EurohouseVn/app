import type { IndustrialSearchItem } from './industrial-query';

export type IndustrialFaq = { question: string; answer: string };
export type RelatedLink = { label: string; href: string };

export type IndustrialService = IndustrialSearchItem & {
  eyebrow: string;
  description: string;
  definition: string;
  image: string;
  deliverables: string[];
  suitableFor: string[];
  benefits: string[];
  requiredInputs: string[];
  process: string[];
  faq: IndustrialFaq[];
  relatedLinks: RelatedLink[];
};

export const industrialServices: IndustrialService[] = [
  service({
    slug: 'dinh-hinh-theo-ban-ve', title: 'Nhôm định hình theo bản vẽ',
    summary: 'Phát triển profile nhôm riêng từ hình học, cách lắp ghép và điều kiện làm việc của sản phẩm.', applications: ['Kiến trúc', 'Cơ khí', 'Thiết bị'],
    definition: 'Dịch vụ dành cho doanh nghiệp đã có ý tưởng, mẫu hoặc bản vẽ mặt cắt và cần chuyển thành profile nhôm có thể đánh giá để sản xuất.',
    suitableFor: ['Sản phẩm cần tiết diện riêng thay cho profile phổ thông', 'Cụm lắp ghép cần đồng bộ kích thước với chi tiết hiện hữu', 'Dự án muốn chuẩn hóa một dải profile dùng lâu dài'],
    benefits: ['Đọc yêu cầu theo đúng bối cảnh sử dụng', 'Phát hiện sớm điểm cần làm rõ trên mặt cắt', 'Tạo đầu mối thống nhất giữa thiết kế và sản xuất'],
    requiredInputs: ['Bản vẽ 2D hoặc 3D có kích thước', 'Mô tả vị trí lắp và chi tiết liên kết', 'Yêu cầu bề mặt và sản lượng dự kiến'],
    process: ['Tiếp nhận và phân loại hồ sơ', 'Trao đổi các điểm ảnh hưởng đến khả năng triển khai', 'Phản hồi phương án và dữ liệu cần bổ sung', 'Thống nhất bước làm mẫu hoặc sản xuất'],
    deliverables: ['Danh sách dữ liệu cần hoàn thiện', 'Phản hồi khả năng triển khai ban đầu', 'Đề xuất bước kỹ thuật tiếp theo'],
  }),
  service({
    slug: 'chi-tiet-may', title: 'Profile nhôm cho chi tiết máy',
    summary: 'Profile phục vụ khung máy, dẫn hướng, che chắn và các cụm cơ khí cần lắp ghép ổn định.', applications: ['Cơ khí', 'Máy móc', 'Tự động hóa'],
    definition: 'Nhóm giải pháp cho nhà chế tạo máy và đơn vị tự động hóa cần profile có hình học phù hợp với tải, liên kết và không gian của cụm thiết bị.',
    suitableFor: ['Khung và vỏ che máy', 'Băng tải, ray dẫn và cụm gá lắp', 'Thiết bị cần tối ưu số công đoạn gia công sau đùn'],
    benefits: ['Tổ chức tiết diện theo chức năng của cụm máy', 'Giảm chi tiết rời khi hình học cho phép', 'Thuận tiện chuẩn hóa vật tư cho nhiều model thiết bị'],
    requiredInputs: ['Bản vẽ mặt cắt và chiều dài sử dụng', 'Mô tả tải, liên kết và môi trường làm việc', 'Yêu cầu gia công sau đùn nếu có'],
    process: ['Làm rõ chức năng của chi tiết', 'Rà soát hình học và điểm lắp ghép', 'Trao đổi bề mặt và công đoạn sau đùn', 'Xác nhận phạm vi cung cấp'],
    deliverables: ['Bản tổng hợp yêu cầu', 'Phản hồi hồ sơ mặt cắt', 'Phạm vi đùn và gia công dự kiến'],
  }),
  service({
    slug: 'nang-luong-mat-troi', title: 'Nhôm cho hệ năng lượng mặt trời',
    summary: 'Profile cho khung tấm pin, thanh đỡ và các kết cấu lắp đặt trong hệ năng lượng mặt trời.', applications: ['Năng lượng', 'Kết cấu', 'Điện mặt trời'],
    definition: 'Giải pháp profile nhôm dành cho đơn vị phát triển thiết bị và kết cấu điện mặt trời, được xem xét theo vị trí lắp, liên kết và môi trường sử dụng.',
    suitableFor: ['Khung bao tấm pin', 'Thanh rail và chi tiết liên kết', 'Kết cấu phụ trợ theo thiết kế riêng'],
    benefits: ['Đồng bộ hình học với bộ liên kết', 'Tập trung trao đổi vào điều kiện lắp đặt thực tế', 'Kết nối nhu cầu đùn, bề mặt và gia công trong cùng hồ sơ'],
    requiredInputs: ['Bản vẽ profile và cụm lắp', 'Khu vực, tư thế và môi trường lắp đặt', 'Kế hoạch sản lượng và tiến độ mong muốn'],
    process: ['Tiếp nhận bộ bản vẽ', 'Làm rõ điều kiện sử dụng và liên kết', 'Rà soát phạm vi đùn, bề mặt, gia công', 'Phản hồi lộ trình triển khai'],
    deliverables: ['Danh sách dữ liệu kỹ thuật cần có', 'Đề xuất phạm vi phối hợp', 'Đầu mối trao đổi cho giai đoạn tiếp theo'],
  }),
  service({
    slug: 'dun-thue', title: 'Đùn thuê profile nhôm',
    summary: 'Nhận đùn profile theo hồ sơ kỹ thuật và kế hoạch cung ứng của khách hàng doanh nghiệp.', applications: ['Sản xuất', 'OEM', 'Cơ khí'],
    definition: 'Dịch vụ cho khách hàng đã sở hữu thiết kế profile và cần một đầu mối đánh giá hồ sơ, tổ chức đùn và phối hợp yêu cầu bề mặt theo kế hoạch.',
    suitableFor: ['Doanh nghiệp có profile hoặc khuôn riêng', 'Nhãn hàng OEM cần tổ chức nguồn cung', 'Nhà máy muốn bổ sung năng lực đùn cho một kế hoạch cụ thể'],
    benefits: ['Phân định rõ vật tư, khuôn và đầu ra mong muốn', 'Thống nhất tiêu chí tiếp nhận trước khi triển khai', 'Dễ theo dõi hồ sơ theo từng mã profile'],
    requiredInputs: ['Bản vẽ và thông tin khuôn nếu đã có', 'Yêu cầu vật liệu, bề mặt và đóng gói', 'Sản lượng theo mã và lịch giao mong muốn'],
    process: ['Kiểm tra tính đầy đủ của hồ sơ', 'Trao đổi điều kiện và phạm vi thực hiện', 'Xác nhận kế hoạch kỹ thuật, thương mại', 'Theo dõi theo mốc đã thống nhất'],
    deliverables: ['Phản hồi hồ sơ đầu vào', 'Phạm vi dịch vụ dự kiến', 'Kế hoạch phối hợp giữa hai bên'],
  }),
  service({
    slug: 'gia-cong', title: 'Gia công sản phẩm nhôm',
    summary: 'Phối hợp các công đoạn cắt, khoan, phay và hoàn thiện chi tiết theo yêu cầu đầu ra.', applications: ['Gia công', 'Thành phẩm', 'OEM'],
    definition: 'Dịch vụ giúp khách hàng nhận chi tiết gần hơn với trạng thái lắp ráp bằng cách xác định rõ công đoạn sau đùn và tiêu chí kiểm tra đầu ra.',
    suitableFor: ['Chi tiết cần cắt và tạo lỗ theo vị trí', 'Cụm OEM muốn giảm công đoạn tại xưởng', 'Sản phẩm cần đóng gói, nhận diện theo mã'],
    benefits: ['Gom yêu cầu profile và gia công vào một luồng trao đổi', 'Làm rõ chuẩn đầu ra trước khi báo phương án', 'Hỗ trợ tổ chức vật tư theo mã chi tiết'],
    requiredInputs: ['Bản vẽ thành phẩm và chuẩn kích thước', 'Mẫu đối chứng hoặc mô tả bề mặt', 'Số lượng, cách đóng gói và lịch nhận hàng'],
    process: ['Phân tích bản vẽ thành phẩm', 'Xác định công đoạn và dữ liệu còn thiếu', 'Thống nhất mẫu hoặc tiêu chí kiểm tra', 'Xác nhận phương án triển khai'],
    deliverables: ['Danh mục công đoạn dự kiến', 'Dữ liệu cần xác nhận trước sản xuất', 'Đề xuất cách bàn giao thành phẩm'],
  }),
];

export const industrialApplications = [...new Set(industrialServices.flatMap((item) => item.applications))].sort((a, b) => a.localeCompare(b, 'vi'));
export const getIndustrialService = (slug: string) => industrialServices.find((item) => item.slug === slug);

function service(input: Omit<IndustrialService, 'eyebrow' | 'description' | 'image' | 'faq' | 'relatedLinks'>): IndustrialService {
  return {
    ...input,
    eyebrow: 'Dịch vụ nhôm công nghiệp',
    description: `${input.definition} Đội ngũ EUROHOUSE sẽ dựa trên bản vẽ và mục tiêu sử dụng để trao đổi phương án phù hợp.`,
    image: '/images/v5/factory-coating.webp',
    faq: [
      { question: 'Khi nào có thể nhận phản hồi phương án?', answer: 'Thời gian phản hồi phụ thuộc mức độ đầy đủ của bản vẽ và yêu cầu đầu ra. Hồ sơ rõ ràng giúp quá trình trao đổi nhanh và tập trung hơn.' },
      { question: 'Có thể gửi hồ sơ chưa hoàn chỉnh không?', answer: 'Có. Hãy gửi phần dữ liệu đang có cùng mô tả mục đích sử dụng; đội ngũ EUROHOUSE sẽ chỉ ra nội dung cần bổ sung cho bước tiếp theo.' },
    ],
    relatedLinks: [
      { label: 'Gửi bản vẽ nhận tư vấn', href: `/yeu-cau-bao-gia-cong-nghiep?service=${input.slug}` },
      { label: 'Xem quy trình phối hợp', href: '/nhom-cong-nghiep/quy-trinh' },
      { label: 'Khám phá năng lực EUROHOUSE', href: '/nang-luc' },
    ],
  };
}
