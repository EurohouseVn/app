/** Chính sách thuần của module AI: hạn mức ảnh, dựng câu lệnh theo xưởng, chặn giả mạo, giới hạn tốc độ. */

export const IMAGE_WEEKLY_LIMIT = 10;
/** Tên người dùng thấy cho trợ lý. Đổi ở đây; app lấy tên từ GET /ai/status. */
export const ASSISTANT_NAME = 'Bé Eu';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type ImageQuota = { limit: number; used: number; remaining: number; resetsAt: Date | null };

/** Cửa sổ trượt 7 ngày. `stamps` là thời điểm các ảnh đã tạo (hoặc đang tạo) của đúng một người dùng. */
export function imageQuota(stamps: Date[], now: Date, limit = IMAGE_WEEKLY_LIMIT): ImageQuota {
  const windowStart = now.getTime() - WEEK_MS;
  const inWindow = stamps.map((stamp) => stamp.getTime()).filter((time) => time > windowStart).sort((a, b) => a - b);
  const used = inWindow.length;
  const remaining = Math.max(0, limit - used);
  const resetsAt = remaining === 0 && inWindow.length ? new Date(inWindow[0] + WEEK_MS) : null;
  return { limit, used, remaining, resetsAt };
}

/** Cắt độ dài, bỏ khoảng trắng thừa và vô hiệu các nhãn khối hệ thống để người dùng không giả mạo câu lệnh xưởng. */
export function sanitizeUserText(value: string, maxLength: number): string {
  return value
    .trim()
    .slice(0, maxLength)
    .replace(/\[(HỆ THỐNG|TÓM TẮT|HỘI THOẠI|CÂU HỎI MỚI|QUY TẮC)/gi, '(…$1');
}

export type PromptTurn = { role: 'USER' | 'ASSISTANT'; content: string };

export type MusePromptInput = {
  workshopName: string;
  systemInstructions: string;
  summary: string;
  history: PromptTurn[];
  message: string;
  /** replay: dựng lại toàn bộ ngữ cảnh từ CSDL (phiên mới hoặc mất phiên); continue: phiên cũ còn, chỉ nhắc ngắn. */
  mode: 'replay' | 'continue';
  maxHistoryChars?: number;
};

const BASE_RULES = [
  `Bạn tên là ${ASSISTANT_NAME}, trợ lý thân thiện của Eurohouse. Khi được hỏi bạn là ai, chỉ nói bạn là ${ASSISTANT_NAME} của Eurohouse; không nhắc tới Muse, Meta, Orion hay bất kỳ nhà cung cấp mô hình nào.`,
  'Bạn là trợ lý AI riêng của đúng một xưởng sản xuất này, không phục vụ xưởng hay khách hàng nào khác.',
  'Không dùng, nhắc lại hay suy ra thông tin của người dùng, xưởng hoặc cuộc trò chuyện khác.',
  'Chỉ trò chuyện bằng chữ: không dùng ví, kết nối, kênh nhắn tin, lịch hay công cụ nào của tài khoản.',
  'Không tạo ảnh hoặc video trong trò chuyện; nếu người dùng cần ảnh, hướng dẫn họ dùng chức năng Tạo ảnh của ứng dụng.',
  'Trả lời bằng ngôn ngữ của người dùng, ngắn gọn, đúng chuyên môn nhôm kính và xưởng sản xuất.',
];

export function buildMusePrompt(input: MusePromptInput): string {
  const header = `[HỆ THỐNG - XƯỞNG "${input.workshopName}"]`;
  if (input.mode === 'continue') {
    return `${header} Vẫn là ${ASSISTANT_NAME} của Eurohouse, trợ lý riêng của xưởng này, giữ nguyên các quy tắc đã nêu.\n[CÂU HỎI MỚI]\n${input.message}`;
  }
  const lines = [header, ...BASE_RULES.map((rule) => `- ${rule}`)];
  if (input.systemInstructions.trim()) lines.push('[QUY TẮC RIÊNG CỦA XƯỞNG]', input.systemInstructions.trim());
  if (input.summary.trim()) lines.push('[TÓM TẮT TRƯỚC ĐÓ]', input.summary.trim());
  const budget = input.maxHistoryChars ?? 12_000;
  const picked: string[] = [];
  let used = 0;
  for (let index = input.history.length - 1; index >= 0; index -= 1) {
    const turn = input.history[index];
    const line = `${turn.role === 'USER' ? 'Người dùng' : 'Trợ lý'}: ${turn.content}`;
    if (used + line.length > budget) break;
    picked.unshift(line);
    used += line.length;
  }
  if (picked.length) lines.push('[HỘI THOẠI GẦN ĐÂY]', ...picked);
  lines.push('[CÂU HỎI MỚI]', input.message);
  return lines.join('\n');
}

export function buildImagePrompt(workshopName: string, description: string): string {
  return `[HỆ THỐNG - XƯỞNG "${workshopName}"] Bạn là ${ASSISTANT_NAME} của Eurohouse. Chỉ tạo đúng MỘT ảnh theo mô tả sau, không hỏi lại, không viết dài, không nhắc tên nhà cung cấp. Mô tả: ${description}`;
}

/** Cổng giới hạn tốc độ toàn hệ thống: cả máy chủ dùng chung một tài khoản Muse nên cần trần tổng. */
export class RequestGate {
  private stamps: number[] = [];
  constructor(private readonly limit: number, private readonly windowMs: number, private readonly clock: () => number = Date.now) {}
  tryAcquire(): boolean {
    const now = this.clock();
    this.stamps = this.stamps.filter((stamp) => now - stamp < this.windowMs);
    if (this.stamps.length >= this.limit) return false;
    this.stamps.push(now);
    return true;
  }
}
