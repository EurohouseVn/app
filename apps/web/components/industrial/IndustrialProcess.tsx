const steps = [
  ['01', 'Tiếp nhận hồ sơ', 'Bản vẽ, ứng dụng, yêu cầu bề mặt và kế hoạch sản lượng nếu đã có.'],
  ['02', 'Đánh giá kỹ thuật', 'Rà soát hình học, phạm vi thực hiện và các dữ liệu cần xác nhận thêm.'],
  ['03', 'Phản hồi phương án', 'Thống nhất đầu mối, tài liệu và bước triển khai tiếp theo.'],
  ['04', 'Theo dõi thực hiện', 'Cập nhật theo hồ sơ đã được hai bên xác nhận.'],
] as const;

export function IndustrialProcess() { return <section className="home-section industrial-process" id="process"><div className="container"><header className="home-section-heading"><p className="home-eyebrow">Quy trình làm việc</p><h2>Từ bản vẽ đến phương án có thể triển khai.</h2></header><ol>{steps.map(([number, title, text]) => <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol></div></section>; }
