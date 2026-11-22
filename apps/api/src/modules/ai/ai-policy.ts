/** Chính sách thuần của module AI: hạn mức ảnh, dựng câu lệnh theo xưởng, chặn giả mạo, giới hạn tốc độ. */

/** Tên người dùng thấy cho trợ lý. Đổi ở đây; app lấy tên từ GET /ai/status. */
export const ASSISTANT_NAME = 'Bé Eu';
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
  /** Đoạn kiến thức Eurohouse liên quan tới câu hỏi (đã truy xuất sẵn). */
  knowledge?: string[];
};

export const BASE_RULES = [
  `Bạn tên là ${ASSISTANT_NAME}, trợ lý thân thiện của Eurohouse. Khi được hỏi bạn là ai, chỉ nói bạn là ${ASSISTANT_NAME} của Eurohouse; không nhắc tới Muse, Meta, Orion hay bất kỳ nhà cung cấp mô hình nào.`,
  'Bạn là trợ lý AI riêng của đúng một xưởng sản xuất này, không phục vụ xưởng hay khách hàng nào khác.',
  'Không dùng, nhắc lại hay suy ra thông tin của người dùng, xưởng hoặc cuộc trò chuyện khác.',
  'Chỉ trò chuyện bằng chữ: không dùng ví, kết nối, kênh nhắn tin, lịch hay công cụ nào của tài khoản.',
  'Chỉ trả lời bằng chữ: không tạo ảnh hay video; nếu người dùng nhờ vẽ/tạo ảnh, nói nhẹ nhàng là Bé Eu hiện chỉ trò chuyện.',
  'Trả lời bằng ngôn ngữ của người dùng, ngắn gọn, đúng chuyên môn nhôm kính và xưởng sản xuất.',
];

export function buildMusePrompt(input: MusePromptInput): string {
  const header = `[HỆ THỐNG - XƯỞNG "${input.workshopName}"]`;
  const knowledge = input.knowledge?.length
    ? `[KIẾN THỨC EUROHOUSE] (ưu tiên dùng để trả lời trực tiếp, không cần tìm kiếm trên mạng nếu đã đủ)\n${input.knowledge.join('\n---\n')}\n`
    : '';
  if (input.mode === 'continue') {
    return `${header} Vẫn là ${ASSISTANT_NAME} của Eurohouse, trợ lý riêng của xưởng này, giữ nguyên các quy tắc đã nêu.\n${knowledge}[CÂU HỎI MỚI]\n${input.message}`;
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
  if (knowledge) lines.push(knowledge.trimEnd());
  lines.push('[CÂU HỎI MỚI]', input.message);
  return lines.join('\n');
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
