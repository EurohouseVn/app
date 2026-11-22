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
  publishedAt: string;
  modifiedAt: string;
  reviewedBy: string;
  topicCluster: 'RESIDENTIAL' | 'INDUSTRIAL';
  relatedRoutes: Array<{ label: string; href: string }>;
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
  { slug: 'nha-may', title: 'Nhà máy', summary: 'Không gian sản xuất và những công đoạn tạo nên profile nhôm EUROHOUSE.', image: '/images/v4/factory-yard.jpg', scope: ['Tiếp nhận profile kiến trúc và công nghiệp', 'Rà soát yêu cầu từ bản vẽ', 'Kết nối đùn, bề mặt và gia công'] },
  { slug: 'cong-nghe-kiem-soat-chat-luong', title: 'Công nghệ và kiểm soát chất lượng', summary: 'Những điểm cần kiểm soát để profile đáp ứng đúng mục đích sử dụng.', image: '/images/factory/factory-3.jpg', scope: ['Làm rõ yêu cầu kỹ thuật', 'Đối chiếu bản vẽ và mẫu', 'Theo dõi các điểm cần trao đổi'] },
  { slug: 'be-mat-mau-sac', title: 'Bề mặt và màu sắc', summary: 'Tổng quan định hướng bề mặt; thông số được xác nhận theo từng hệ và môi trường sử dụng.', image: '/images/v5/finish-wood.webp', scope: ['Tiếp nhận yêu cầu màu và bề mặt', 'Đối chiếu mẫu hoặc tài liệu được duyệt', 'Xác nhận phạm vi theo hồ sơ'] },
  { slug: 'khuon-dun', title: 'Khuôn đùn', summary: 'Quy trình tiếp nhận hình học profile và phối hợp đánh giá phương án khuôn.', image: '/images/v4/aluminum-billets.jpg', scope: ['Tiếp nhận bản vẽ', 'Rà soát hình học và ứng dụng', 'Phản hồi dữ liệu cần bổ sung'] },
  { slug: 'video', title: 'Video năng lực', summary: 'Tư liệu trực quan về môi trường sản xuất và sản phẩm EUROHOUSE.', image: '/media/eurohouse-factory-line-poster.webp', scope: ['Video có poster và mô tả', 'Không tự động phát âm thanh', 'Có nội dung chữ thay thế'] },
];

export const resourceEntries = [
  { title: 'Catalog sản phẩm', summary: 'Tìm dòng nhôm, mã profile, mặt cắt và ứng dụng trong một tài liệu.', href: '/tai-nguyen/catalog', type: 'Catalog' },
  { title: 'Hồ sơ năng lực', summary: 'Tổng quan về EUROHOUSE, sản phẩm và năng lực phục vụ khách hàng.', href: '/tai-nguyen/profile', type: 'Hồ sơ' },
  { title: 'Tài liệu kỹ thuật', summary: 'Bản vẽ và hướng dẫn được sắp xếp theo hệ sản phẩm.', href: '/tai-nguyen/tai-lieu-ky-thuat', type: 'Kỹ thuật' },
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
    publishedAt: '2026-09-15', modifiedAt: '2026-11-11', reviewedBy: 'Ban nội dung EUROHOUSE', topicCluster: 'INDUSTRIAL',
    relatedRoutes: [{ label: 'Nhôm công nghiệp', href: '/nhom-cong-nghiep' }, { label: 'Định hình theo bản vẽ', href: '/nhom-cong-nghiep/dinh-hinh-theo-ban-ve' }],
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
    publishedAt: '2026-09-18', modifiedAt: '2026-11-11', reviewedBy: 'Ban nội dung EUROHOUSE', topicCluster: 'RESIDENTIAL',
    relatedRoutes: [{ label: 'Nhôm dân dụng', href: '/nhom-dan-dung' }, { label: 'So sánh hệ nhôm', href: '/nhom-dan-dung/so-sanh' }],
    sections: [
      { title: 'Xác định nhu cầu sử dụng', paragraphs: ['Hãy bắt đầu từ loại công trình, vị trí ô cửa, kiểu mở mong muốn và cách không gian được sử dụng hằng ngày.'] },
      { title: 'Đối chiếu hệ sản phẩm', paragraphs: ['Sau khi có nhu cầu, tra cứu dòng sản phẩm và hệ chuyên dụng tương ứng. Với cấu hình riêng, hãy gửi kích thước và kiểu mở để đội ngũ EUROHOUSE tư vấn chính xác hơn.'] },
      { title: 'Chuẩn bị cho tư vấn', paragraphs: ['Ảnh hiện trạng, kích thước sơ bộ và khu vực công trình giúp cuộc trao đổi tập trung hơn.'] },
    ],
  },
  {
    slug: 'doc-phien-ban-tai-lieu-ky-thuat',
    title: 'Cách đọc phiên bản tài liệu kỹ thuật',
    summary: 'Tên tài liệu chưa đủ; cần kiểm tra revision, ngày hiệu lực và hệ sản phẩm liên quan.',
    readingLabel: 'Quản trị tài liệu',
    publishedAt: '2026-09-20', modifiedAt: '2026-11-11', reviewedBy: 'Ban nội dung EUROHOUSE', topicCluster: 'RESIDENTIAL',
    relatedRoutes: [{ label: 'Catalog EUROHOUSE', href: '/tai-nguyen/catalog' }, { label: 'Tài liệu kỹ thuật', href: '/tai-nguyen/tai-lieu-ky-thuat' }],
    sections: [
      { title: 'Ba thông tin cần kiểm tra', paragraphs: ['Trước khi sử dụng một tài liệu, hãy kiểm tra tên, phiên bản và ngày hiệu lực được hiển thị cùng tệp.'] },
      { title: 'Không dùng bản không rõ nguồn', paragraphs: ['Tệp được chuyển tiếp qua nhiều kênh có thể đã cũ. Trung tâm tài nguyên chỉ hiển thị tài liệu đã được đặt trạng thái công khai.'] },
      { title: 'Khi còn nghi ngờ', paragraphs: ['Liên hệ EUROHOUSE để xác nhận phiên bản đang áp dụng trước khi dùng dữ liệu cho sản xuất hoặc thi công.'] },
    ],
  },
  {
    slug: 'du-lieu-can-co-khi-bao-gia-dun-nhom',
    title: 'Dữ liệu cần có khi yêu cầu báo giá đùn nhôm',
    summary: 'Bản vẽ, vật liệu, bề mặt, sản lượng theo mã và lịch giao là năm nhóm dữ liệu giúp yêu cầu đùn nhôm được đánh giá đúng trọng tâm.',
    readingLabel: 'Chuẩn bị báo giá', publishedAt: '2026-10-02', modifiedAt: '2026-11-11', reviewedBy: 'Ban nội dung EUROHOUSE', topicCluster: 'INDUSTRIAL',
    relatedRoutes: [{ label: 'Đùn thuê profile nhôm', href: '/nhom-cong-nghiep/dun-thue' }, { label: 'Nhôm công nghiệp', href: '/nhom-cong-nghiep' }],
    sections: [
      { title: 'Năm nhóm dữ liệu nên gửi cùng nhau', paragraphs: ['Chuẩn bị mặt cắt có kích thước, mục đích sử dụng, yêu cầu bề mặt, sản lượng dự kiến theo từng mã và mốc giao hàng mong muốn.'], bullets: ['Bản vẽ và thông tin khuôn nếu đã có', 'Yêu cầu vật liệu và bề mặt', 'Sản lượng, chiều dài và đóng gói', 'Địa điểm cùng lịch nhận hàng'] },
      { title: 'Điều gì xảy ra sau khi gửi?', paragraphs: ['Đội ngũ EUROHOUSE rà soát mức độ đầy đủ của hồ sơ, tập hợp câu hỏi còn thiếu và trao đổi phạm vi đùn, bề mặt hoặc gia công trước khi lập phương án.'] },
    ],
  },
  {
    slug: 'profile-nhom-cho-chi-tiet-may',
    title: 'Thiết kế profile nhôm cho chi tiết máy bắt đầu từ đâu?',
    summary: 'Chức năng của cụm máy, tải, vị trí liên kết và công đoạn sau đùn quyết định cách một bản vẽ profile nên được chuẩn bị để trao đổi.',
    readingLabel: 'Chi tiết máy', publishedAt: '2026-10-06', modifiedAt: '2026-11-11', reviewedBy: 'Ban nội dung EUROHOUSE', topicCluster: 'INDUSTRIAL',
    relatedRoutes: [{ label: 'Profile cho chi tiết máy', href: '/nhom-cong-nghiep/chi-tiet-may' }, { label: 'Năng lực khuôn đùn', href: '/nang-luc/khuon-dun' }],
    sections: [
      { title: 'Mô tả chức năng trước hình học', paragraphs: ['Hãy nêu chi tiết dùng để làm khung, dẫn hướng, che chắn hay gá lắp; đồng thời chỉ rõ những bề mặt và lỗ liên kết làm việc với bộ phận khác.'] },
      { title: 'Tách yêu cầu đùn và gia công', paragraphs: ['Đánh dấu phần hình học tạo trực tiếp trên profile và phần cần cắt, khoan hoặc phay sau đùn. Cách tách này giúp hai bên hiểu đúng trạng thái đầu ra mong muốn.'] },
    ],
  },
  {
    slug: 'chuan-bi-ho-so-nhom-nang-luong-mat-troi',
    title: 'Chuẩn bị hồ sơ nhôm cho hệ năng lượng mặt trời',
    summary: 'Một hồ sơ solar hữu ích cần cho thấy profile nằm ở đâu trong cụm lắp, liên kết bằng cách nào và làm việc trong môi trường nào.',
    readingLabel: 'Năng lượng mặt trời', publishedAt: '2026-10-10', modifiedAt: '2026-11-11', reviewedBy: 'Ban nội dung EUROHOUSE', topicCluster: 'INDUSTRIAL',
    relatedRoutes: [{ label: 'Nhôm năng lượng mặt trời', href: '/nhom-cong-nghiep/nang-luong-mat-troi' }, { label: 'Quy trình công nghiệp', href: '/nhom-cong-nghiep/quy-trinh' }],
    sections: [
      { title: 'Cho thấy cả profile và cụm lắp', paragraphs: ['Ngoài mặt cắt, nên có hình cụm khung, rail hoặc liên kết để đội kỹ thuật hiểu hướng chịu tác động và vị trí của từng chi tiết.'] },
      { title: 'Nêu điều kiện sử dụng', paragraphs: ['Khu vực lắp đặt, tư thế lắp, yêu cầu bề mặt, cách đóng gói và kế hoạch sản lượng là dữ liệu quan trọng cho bước trao đổi phương án.'] },
    ],
  },
  {
    slug: 'cac-cong-doan-gia-cong-sau-dun',
    title: 'Cách mô tả công đoạn gia công sau đùn',
    summary: 'Bản vẽ thành phẩm, chuẩn kích thước, vị trí cắt khoan phay và cách đóng gói giúp xác định rõ profile cần được bàn giao ở trạng thái nào.',
    readingLabel: 'Gia công sau đùn', publishedAt: '2026-10-14', modifiedAt: '2026-11-11', reviewedBy: 'Ban nội dung EUROHOUSE', topicCluster: 'INDUSTRIAL',
    relatedRoutes: [{ label: 'Gia công sản phẩm nhôm', href: '/nhom-cong-nghiep/gia-cong' }, { label: 'Kiểm soát chất lượng', href: '/nang-luc/cong-nghe-kiem-soat-chat-luong' }],
    sections: [
      { title: 'Dùng bản vẽ trạng thái bàn giao', paragraphs: ['Đánh dấu chiều dài cắt, lỗ, rãnh, bề mặt chuẩn và mã nhận diện trên bản vẽ thành phẩm thay vì chỉ gửi mặt cắt profile.'] },
      { title: 'Thống nhất cách kiểm tra', paragraphs: ['Nêu chi tiết nào lắp ghép trực tiếp, mẫu đối chứng nếu có và cách đóng gói mong muốn để bước đánh giá tập trung vào đầu ra thực tế.'] },
    ],
  },
  {
    slug: 'cach-dung-catalog-nhom-eurohouse',
    title: 'Cách dùng catalog nhôm EUROHOUSE để chọn hệ',
    summary: 'Catalog hữu ích nhất khi được đọc cùng loại công trình, kiểu mở, kích thước sơ bộ và mục tiêu thẩm mỹ thay vì chỉ tìm một mã profile.',
    readingLabel: 'Hướng dẫn catalog', publishedAt: '2026-10-18', modifiedAt: '2026-11-11', reviewedBy: 'Ban nội dung EUROHOUSE', topicCluster: 'RESIDENTIAL',
    relatedRoutes: [{ label: 'Catalog EUROHOUSE', href: '/tai-nguyen/catalog' }, { label: 'Nhôm dân dụng', href: '/nhom-dan-dung' }],
    sections: [
      { title: 'Bắt đầu từ cấu hình cửa', paragraphs: ['Xác định cửa đi hay cửa sổ, kiểu mở, vị trí trong công trình và cảm giác hình khối mong muốn trước khi đối chiếu dòng sản phẩm.'] },
      { title: 'Ghi lại câu hỏi khi tra mã', paragraphs: ['Lập danh sách mã đang quan tâm, ảnh hiện trạng và kích thước sơ bộ. Những dữ liệu này giúp cuộc trao đổi với đơn vị tư vấn cụ thể và nhanh hơn.'] },
    ],
  },
];

export const faqItems = [
  { question: 'EUROHOUSE có những nhóm sản phẩm nào?', answer: 'Website chia sản phẩm thành hai nhóm chính: Nhôm dân dụng và Nhôm công nghiệp. Mỗi nhóm có tuyến tra cứu và hành động liên hệ riêng.' },
  { question: 'Tôi có thể gửi bản vẽ nhôm công nghiệp ở đâu?', answer: 'Mở trang Nhôm công nghiệp, chọn dịch vụ phù hợp và dùng nút Gửi bản vẽ. Trong giai đoạn hiện tại, hồ sơ được tiếp nhận qua email chính thức để bảo vệ dữ liệu kỹ thuật.' },
  { question: 'Tài liệu kỹ thuật trên website có phải bản đang áp dụng không?', answer: 'Chỉ tài liệu có tệp công khai, revision và ngày hiệu lực mới được hiển thị. Nếu chưa thấy tài liệu cần dùng, hãy liên hệ để xác nhận.' },
  { question: 'Website có công bố giá dành cho nhà phân phối không?', answer: 'Không. Giá, công nợ và dữ liệu tổ chức của nhà phân phối chỉ có trong Cổng NPP sau khi đăng nhập.' },
  { question: 'Làm sao biết EUROHOUSE có phù hợp với profile tôi đang phát triển?', answer: 'Hãy gửi bản vẽ cùng mô tả ứng dụng, bề mặt và sản lượng dự kiến. Đội ngũ EUROHOUSE sẽ phản hồi các dữ liệu cần làm rõ và hướng phối hợp tiếp theo.' },
  { question: 'Nên chọn hệ nhôm dân dụng theo tiêu chí nào?', answer: 'Hãy bắt đầu từ loại công trình, vị trí ô cửa, kiểu mở, mức độ sử dụng và phong cách kiến trúc; sau đó đối chiếu catalog và trao đổi với đơn vị tư vấn.' },
  { question: 'EUROHOUSE có nhận đùn thuê và gia công sau đùn không?', answer: 'Có tuyến tiếp nhận riêng cho đùn thuê profile và gia công sản phẩm nhôm. Phạm vi thực hiện được trao đổi từ bản vẽ thành phẩm và yêu cầu đầu ra của từng hồ sơ.' },
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
