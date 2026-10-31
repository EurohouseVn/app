import type { SiteSearchEntry } from './explore-content';

export type CapabilityTopic = {
  slug: string;
  title: string;
  summary: string;
  image: string;
  scope: string[];
};

export type KnowledgeArticle = {
  slug: string;
  title: string;
  summary: string;
  readingLabel: string;
  sections: Array<{ title: string; paragraphs: string[]; bullets?: string[] }>;
};

export type PublicVideo = {
  slug: string;
  title: string;
  summary: string;
  url: string;
  posterUrl: string;
  caption: string;
  transcript: string;
  updatedLabel: string;
  orientation: 'landscape' | 'portrait';
};

export const capabilityTopics: CapabilityTopic[] = [
  { slug: 'nha-may', title: 'Nhà máy', summary: 'Không gian sản xuất và các công đoạn được công bố bằng hình ảnh thực tế.', image: '/images/v4/factory-yard.jpg', scope: ['Tiếp nhận yêu cầu profile kiến trúc và công nghiệp', 'Đánh giá phạm vi theo hồ sơ kỹ thuật', 'Công bố số liệu khi có nguồn và phê duyệt'] },
  { slug: 'cong-nghe-kiem-soat-chat-luong', title: 'Công nghệ và kiểm soát chất lượng', summary: 'Cách EUROHOUSE tổ chức dữ liệu kiểm tra theo hồ sơ đã xác nhận.', image: '/images/factory/factory-3.jpg', scope: ['Rà soát yêu cầu kỹ thuật', 'Đối chiếu tài liệu theo phiên bản', 'Ghi nhận nội dung cần xác nhận thêm'] },
  { slug: 'be-mat-mau-sac', title: 'Bề mặt và màu sắc', summary: 'Tổng quan định hướng bề mặt; thông số được xác nhận theo từng hệ và môi trường sử dụng.', image: '/images/v5/finish-wood.webp', scope: ['Tiếp nhận yêu cầu màu và bề mặt', 'Đối chiếu mẫu hoặc tài liệu được duyệt', 'Xác nhận phạm vi theo hồ sơ'] },
  { slug: 'khuon-dun', title: 'Khuôn đùn', summary: 'Quy trình tiếp nhận hình học profile và phối hợp đánh giá phương án khuôn.', image: '/images/v4/aluminum-billets.jpg', scope: ['Tiếp nhận bản vẽ', 'Rà soát hình học và ứng dụng', 'Phản hồi dữ liệu cần bổ sung'] },
  { slug: 'video', title: 'Video năng lực', summary: 'Tư liệu trực quan về môi trường sản xuất và sản phẩm EUROHOUSE.', image: '/media/eurohouse-factory-line-poster.webp', scope: ['Video có poster và mô tả', 'Không tự động phát âm thanh', 'Có nội dung chữ thay thế'] },
];

export const resourceEntries = [
  { title: 'Catalog sản phẩm', summary: 'Catalog chỉ xuất hiện khi có phiên bản, ngày hiệu lực và tệp công khai.', href: '/tai-nguyen/catalog', type: 'Catalog' },
  { title: 'Hồ sơ năng lực', summary: 'Tài liệu giới thiệu doanh nghiệp đã qua quy trình phê duyệt.', href: '/tai-nguyen/profile', type: 'Hồ sơ' },
  { title: 'Tài liệu kỹ thuật', summary: 'Tài liệu theo hệ sản phẩm và phiên bản hiệu lực.', href: '/tai-nguyen/tai-lieu-ky-thuat', type: 'Kỹ thuật' },
  { title: 'Thư viện video', summary: 'Video sản phẩm, quy trình và nhà máy kèm mô tả có thể đọc.', href: '/tai-nguyen/video', type: 'Video' },
] as const;

export const publicVideos: PublicVideo[] = [
  {
    slug: 'day-chuyen-nha-may-eurohouse',
    title: 'Bên trong dây chuyền sản xuất EUROHOUSE',
    summary: 'Tư liệu thực tế ghi lại một công đoạn xử lý profile trong môi trường nhà máy.',
    url: '/media/eurohouse-factory-line.mp4',
    posterUrl: '/media/eurohouse-factory-line-poster.webp',
    caption: 'Tư liệu nhà máy EUROHOUSE; thông số kỹ thuật được xác nhận theo từng hồ sơ.',
    transcript: 'Video ghi lại hệ thống máy và các thanh profile đang được đưa qua một công đoạn xử lý trong nhà máy. Nội dung giúp người xem nhận biết môi trường sản xuất; video không được dùng để suy diễn công suất, dung sai hoặc phạm vi thiết bị.',
    updatedLabel: 'Cập nhật nội dung: 2026',
    orientation: 'landscape',
  },
];

export const knowledgeArticles: KnowledgeArticle[] = [
  {
    slug: 'cach-chuan-bi-ban-ve-nhom-cong-nghiep',
    title: 'Cách chuẩn bị bản vẽ nhôm công nghiệp',
    summary: 'Một hồ sơ rõ ứng dụng, hình học và yêu cầu bề mặt giúp bước đánh giá kỹ thuật đi đúng trọng tâm.',
    readingLabel: 'Hướng dẫn kỹ thuật',
    sections: [
      { title: 'Bắt đầu từ ứng dụng', paragraphs: ['Nêu sản phẩm sẽ được dùng ở đâu, chịu tác động gì và cần lắp ghép với bộ phận nào. Thông tin này giúp đội kỹ thuật đọc bản vẽ đúng bối cảnh.'] },
      { title: 'Hồ sơ nên có', paragraphs: ['Gửi bản vẽ ở định dạng có thể đọc rõ kích thước và ghi chú. Nếu yêu cầu chưa hoàn chỉnh, hãy đánh dấu phần cần trao đổi thay vì tự chốt thông số.'], bullets: ['Hình học profile và kích thước tham chiếu', 'Ứng dụng và điều kiện sử dụng', 'Yêu cầu bề mặt nếu đã xác định', 'Kế hoạch sản lượng dự kiến'] },
      { title: 'Thông tin được xác nhận sau', paragraphs: ['Vật liệu, dung sai, sản lượng tối thiểu và tiến độ chỉ được xác nhận sau khi hồ sơ đã được rà soát.'] },
    ],
  },
  {
    slug: 'chon-he-nhom-theo-ung-dung',
    title: 'Chọn hệ nhôm theo ứng dụng, không chỉ theo tên hệ',
    summary: 'Không gian sử dụng, kiểu mở và yêu cầu thiết kế là điểm bắt đầu phù hợp hơn một mã profile đơn lẻ.',
    readingLabel: 'Gợi ý lựa chọn',
    sections: [
      { title: 'Xác định nhu cầu sử dụng', paragraphs: ['Hãy bắt đầu từ loại công trình, vị trí ô cửa, kiểu mở mong muốn và cách không gian được sử dụng hằng ngày.'] },
      { title: 'Đối chiếu hệ sản phẩm', paragraphs: ['Sau khi có nhu cầu, tra cứu dòng sản phẩm và hệ chuyên dụng tương ứng. Các thông số chưa được công bố cần được xác nhận trực tiếp.'] },
      { title: 'Chuẩn bị cho tư vấn', paragraphs: ['Ảnh hiện trạng, kích thước sơ bộ và khu vực công trình giúp cuộc trao đổi tập trung hơn.'] },
    ],
  },
  {
    slug: 'doc-phien-ban-tai-lieu-ky-thuat',
    title: 'Cách đọc phiên bản tài liệu kỹ thuật',
    summary: 'Tên tài liệu chưa đủ; cần kiểm tra revision, ngày hiệu lực và hệ sản phẩm liên quan.',
    readingLabel: 'Quản trị tài liệu',
    sections: [
      { title: 'Ba thông tin cần kiểm tra', paragraphs: ['Trước khi sử dụng một tài liệu, hãy kiểm tra tên, phiên bản và ngày hiệu lực được hiển thị cùng tệp.'] },
      { title: 'Không dùng bản không rõ nguồn', paragraphs: ['Tệp được chuyển tiếp qua nhiều kênh có thể đã cũ. Trung tâm tài nguyên chỉ hiển thị tài liệu đã được đặt trạng thái công khai.'] },
      { title: 'Khi còn nghi ngờ', paragraphs: ['Liên hệ EUROHOUSE để xác nhận phiên bản đang áp dụng trước khi dùng dữ liệu cho sản xuất hoặc thi công.'] },
    ],
  },
];

export const faqItems = [
  { question: 'EUROHOUSE có những nhóm sản phẩm nào?', answer: 'Website chia sản phẩm thành hai nhóm chính: Nhôm dân dụng và Nhôm công nghiệp. Mỗi nhóm có tuyến tra cứu và hành động liên hệ riêng.' },
  { question: 'Tôi có thể gửi bản vẽ nhôm công nghiệp ở đâu?', answer: 'Mở trang Nhôm công nghiệp, chọn dịch vụ phù hợp và dùng nút Gửi bản vẽ. Trong giai đoạn hiện tại, hồ sơ được tiếp nhận qua email chính thức để bảo vệ dữ liệu kỹ thuật.' },
  { question: 'Tài liệu kỹ thuật trên website có phải bản đang áp dụng không?', answer: 'Chỉ tài liệu có tệp công khai, revision và ngày hiệu lực mới được hiển thị. Nếu chưa thấy tài liệu cần dùng, hãy liên hệ để xác nhận.' },
  { question: 'Website có công bố giá dành cho nhà phân phối không?', answer: 'Không. Giá, công nợ và dữ liệu tổ chức của nhà phân phối chỉ có trong Cổng NPP sau khi đăng nhập.' },
  { question: 'Thông số nhà máy chưa hiển thị có nghĩa là không có năng lực đó không?', answer: 'Không. Điều đó chỉ có nghĩa thông số chưa có nguồn được duyệt để công bố công khai. Hãy gửi yêu cầu để được xác nhận theo hồ sơ.' },
] as const;

export const baseSiteSearchIndex: SiteSearchEntry[] = [
  { title: 'Nhôm dân dụng', summary: 'Hệ cửa, hệ chuyên dụng và giải pháp cho công trình.', href: '/nhom-dan-dung', kind: 'Sản phẩm' },
  { title: 'Nhôm công nghiệp', summary: 'Định hình theo bản vẽ, chi tiết máy, năng lượng và gia công.', href: '/nhom-cong-nghiep', kind: 'Dịch vụ' },
  { title: 'Dự án', summary: 'Case study chỉ công bố nội dung và hình ảnh đã được xác nhận.', href: '/du-an', kind: 'Dự án' },
  { title: 'Năng lực EUROHOUSE', summary: 'Nhà máy, kiểm soát chất lượng, bề mặt và khuôn đùn.', href: '/nang-luc', kind: 'Năng lực' },
  { title: 'Tài nguyên', summary: 'Catalog, hồ sơ năng lực, tài liệu kỹ thuật và video.', href: '/tai-nguyen', kind: 'Tài nguyên' },
  { title: 'Nhà phân phối', summary: 'Thông tin hợp tác và lối vào Cổng NPP.', href: '/nha-phan-phoi', kind: 'Doanh nghiệp' },
  ...capabilityTopics.map((item) => ({ title: item.title, summary: item.summary, href: `/nang-luc/${item.slug}`, kind: 'Năng lực' })),
  ...knowledgeArticles.map((item) => ({ title: item.title, summary: item.summary, href: `/kien-thuc/${item.slug}`, kind: 'Kiến thức' })),
  ...publicVideos.map((item) => ({ title: item.title, summary: item.summary, href: `/tai-nguyen/video/${item.slug}`, kind: 'Video' })),
];
