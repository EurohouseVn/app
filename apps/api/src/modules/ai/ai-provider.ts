export type AiProviderImage = { mime: string; base64: string; width?: number; height?: number };
export type AiProviderResult = { threadId: string | null; text: string; images: AiProviderImage[] };
export type AiProviderAsk = { threadId?: string | null; prompt: string; timeoutMs?: number; expectImage?: boolean };

export interface AiProviderPort {
  readonly configured: boolean;
  ask(input: AiProviderAsk): Promise<AiProviderResult>;
}
export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AiProviderErrorCode = 'UNAVAILABLE' | 'THREAD_LOST' | 'TIMEOUT' | 'REJECTED';
export class AiProviderError extends Error {
  constructor(readonly code: AiProviderErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AiProviderError';
  }
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

/** Gọi cầu nối trình duyệt tới muse.ai (container `muse-bridge`) qua mạng nội bộ. */
export class MuseBridgeProvider implements AiProviderPort {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  get configured() {
    return Boolean(this.baseUrl && this.token);
  }

  async ask(input: AiProviderAsk): Promise<AiProviderResult> {
    if (!this.configured) throw new AiProviderError('UNAVAILABLE', 'AI_NOT_CONFIGURED');
    const timeoutMs = input.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 15_000);
    try {
      const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/v1/ask`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: input.threadId ?? undefined, prompt: input.prompt, timeoutMs, expectImage: input.expectImage === true }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        return {
          threadId: body.threadId ?? null,
          text: String(body.text ?? ''),
          images: Array.isArray(body.images) ? body.images : [],
        };
      }
      if (response.status === 409) throw new AiProviderError('THREAD_LOST');
      if (response.status === 504) throw new AiProviderError('TIMEOUT');
      if (response.status === 400) throw new AiProviderError('REJECTED', String(body.error ?? 'REJECTED'));
      throw new AiProviderError('UNAVAILABLE', String(body.error ?? response.status));
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError('UNAVAILABLE', String((error as Error)?.message ?? error));
    } finally {
      clearTimeout(timer);
    }
  }
}
