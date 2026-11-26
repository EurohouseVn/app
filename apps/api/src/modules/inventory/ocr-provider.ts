import type { ExtractedGroup } from '@eurohouse/types';

/**
 * Cổng đọc chữ từ ảnh phiếu. Phần còn lại của hệ thống chỉ biết "ảnh vào, các nhóm dòng ra": đổi mô hình đọc chữ
 * (Qwen3-VL trên card Tesla P4, PaddleOCR, hay một API trả phí) chỉ là đổi cấu hình dịch vụ phía sau, không sửa nghiệp vụ
 * (docs/design/NPP_OCR_EVALUATION.md mục 6).
 */
export type OcrExtractInput = { imageBase64: string; mime: string; kind: 'ORDER' | 'RECEIPT' };
export type OcrExtractResult = { engine: string; groups: ExtractedGroup[] };

export interface OcrProviderPort {
  readonly configured: boolean;
  readonly engine: string;
  extract(input: OcrExtractInput): Promise<OcrExtractResult>;
}

export const OCR_PROVIDER = Symbol('OCR_PROVIDER');

/** Chưa cài dịch vụ đọc chữ: phiếu vẫn lập được bản nháp để nhập tay, có gợi ý ghép danh mục. */
export class NullOcrProvider implements OcrProviderPort {
  readonly configured = false;
  readonly engine = 'none';
  async extract(): Promise<OcrExtractResult> {
    throw new Error('Chưa cài dịch vụ đọc ảnh tự động.');
  }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

function cleanGroups(value: unknown): ExtractedGroup[] {
  if (!Array.isArray(value)) throw new Error('Dịch vụ đọc ảnh trả về dữ liệu không đúng dạng (thiếu groups).');
  return value.map((group) => {
    const g = group as { heading?: unknown; lines?: unknown };
    if (!g || !Array.isArray(g.lines)) throw new Error('Dịch vụ đọc ảnh trả về nhóm không có dòng.');
    return {
      heading: typeof g.heading === 'string' ? g.heading.slice(0, 120) : '',
      lines: g.lines
        .map((line) => {
          const l = line as { text?: unknown; quantity?: unknown; unit?: unknown };
          const quantity = typeof l.quantity === 'number' && Number.isFinite(l.quantity) ? l.quantity : null;
          return { text: typeof l.text === 'string' ? l.text.slice(0, 200) : '', quantity, unit: typeof l.unit === 'string' ? l.unit.slice(0, 20) : null };
        })
        .filter((line) => line.text.trim().length > 0),
    };
  });
}

/**
 * Gọi dịch vụ đọc ảnh tự chạy trên máy chủ nhà. Hợp đồng:
 *   POST {url}/v1/extract   { imageBase64, mime, kind }   (Authorization: Bearer <token>)
 *   -> { engine, groups: [{ heading, lines: [{ text, quantity, unit }] }] }
 * heading là tiêu đề nhóm (màu nhôm, hệ nhôm...), unit là chữ như đọc được ("bó", "cây", "b", "c").
 */
export class HttpOcrProvider implements OcrProviderPort {
  readonly configured: boolean;
  engine = 'ocr-service';

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 180_000,
  ) {
    this.configured = Boolean(baseUrl);
  }

  async extract(input: OcrExtractInput): Promise<OcrExtractResult> {
    if (!this.configured) throw new Error('Chưa cài dịch vụ đọc ảnh tự động.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/v1/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Dịch vụ đọc ảnh báo lỗi ${response.status}.`);
      const body = (await response.json()) as { engine?: unknown; groups?: unknown };
      const engine = typeof body.engine === 'string' && body.engine ? body.engine.slice(0, 60) : this.engine;
      this.engine = engine;
      return { engine, groups: cleanGroups(body.groups) };
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') throw new Error('Dịch vụ đọc ảnh trả lời quá chậm.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function resolveOcrProvider(env: NodeJS.ProcessEnv = process.env): OcrProviderPort {
  const url = (env.OCR_SERVICE_URL ?? '').trim();
  return url ? new HttpOcrProvider(url, (env.OCR_SERVICE_TOKEN ?? '').trim()) : new NullOcrProvider();
}
