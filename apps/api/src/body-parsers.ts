import { json, urlencoded } from 'express';

type UseTarget = { use: (...args: any[]) => unknown };

/** Giới hạn thân yêu cầu JSON mặc định của Express, giữ nguyên cho mọi đường trừ đường tải ảnh phiếu. */
export const DEFAULT_JSON_LIMIT = '100kb';
export const DOCUMENT_UPLOAD_PATH = '/api/npp/documents';
export const DOCUMENT_UPLOAD_LIMIT = '14mb';

/**
 * Ảnh phiếu gửi dạng base64 trong JSON nên đường /api/npp/documents cần giới hạn lớn hơn; mọi đường khác giữ 100 KB.
 * Phải tắt bộ đọc thân mặc định của Nest (NestFactory.create với bodyParser: false) rồi tự đăng ký ở đây: nếu chỉ thêm
 * json() vào trước, Nest thấy đã có "jsonParser" nên bỏ qua việc đăng ký bộ đọc JSON chung, và MỌI đường (kể cả đăng nhập)
 * mất thân yêu cầu. Thứ tự quan trọng: đường lớn trước, đường chung sau (json() bỏ qua yêu cầu đã được đọc).
 */
export function configureBodyParsers(app: UseTarget) {
  app.use(DOCUMENT_UPLOAD_PATH, json({ limit: DOCUMENT_UPLOAD_LIMIT }));
  app.use(json({ limit: DEFAULT_JSON_LIMIT }));
  app.use(urlencoded({ extended: true }));
}
