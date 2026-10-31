export function SpecificationTable({ rows }: { rows: readonly { label: string; value: string }[] }) {
  return <div className="specification-table"><dl>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><p>Thông tin được trình bày theo dữ liệu đang công bố; vui lòng liên hệ để xác nhận cấu hình cho hồ sơ cụ thể.</p></div>;
}
