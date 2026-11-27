const GENERIC_PREFIXES = ['XUONG-', 'CSSX-', 'NPP-'];

/**
 * Rút gọn mã để hiển thị: bỏ tiền tố chung ("XUONG-", "CSSX-", "NPP-") vì cột và tiêu đề đã nói rõ đó là gì.
 * Giữ nguyên khi phần còn lại bắt đầu bằng số (ví dụ "XUONG-01"), vì bỏ tiền tố sẽ chỉ còn lại một con số vô nghĩa.
 * Chỉ dùng để hiển thị: mã thật vẫn là mã đầy đủ khi gọi API, tìm kiếm và đặt tên tệp.
 */
export function shortCode(code: string | null | undefined): string {
  if (code === null || code === undefined) return '-';
  for (const prefix of GENERIC_PREFIXES) {
    if (code.startsWith(prefix)) {
      const rest = code.slice(prefix.length);
      return rest.length >= 3 && !/^\d/.test(rest) ? rest : code;
    }
  }
  return code;
}
