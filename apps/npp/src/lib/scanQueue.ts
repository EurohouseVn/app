/**
 * Hàng đợi quét khi mất mạng: mỗi lần quét đã có idempotencyKey riêng nên gửi lại sau không bị cộng hoặc trừ hai lần.
 * Lưu trong localStorage của điện thoại, tối đa 500 lần quét.
 */
export const DEFAULT_SCAN_PATH = '/npp/glass/stock/scan';

/** Một lần quét chờ gửi: nội dung, đường dẫn API đích (quét kho hoặc quét kiểm kê) và khóa chống trùng. */
export type QueuedScan<T extends { idempotencyKey: string } = { idempotencyKey: string } & Record<string, unknown>> = { id: string; input: T; path: string; queuedAt: number };

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const SCAN_QUEUE_KEY = 'eurohouse-npp-scan-queue';
export const SCAN_QUEUE_MAX = 500;

export class ScanQueue {
  constructor(private readonly store: Store, private readonly key: string = SCAN_QUEUE_KEY) {}

  list<T extends { idempotencyKey: string } = { idempotencyKey: string } & Record<string, unknown>>(): QueuedScan<T>[] {
    try {
      const parsed = JSON.parse(this.store.getItem(this.key) ?? '[]') as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is QueuedScan<T> => !!item && typeof (item as QueuedScan<T>).id === 'string' && !!(item as QueuedScan<T>).input)
        .map((item) => ({ ...item, path: typeof item.path === 'string' && item.path ? item.path : DEFAULT_SCAN_PATH }));
    } catch {
      return [];
    }
  }

  private save(items: QueuedScan<any>[]) {
    this.store.setItem(this.key, JSON.stringify(items.slice(-SCAN_QUEUE_MAX)));
  }

  /** Thêm một lần quét; cùng idempotencyKey thì không thêm lần hai. */
  add<T extends { idempotencyKey: string }>(input: T, path: string = DEFAULT_SCAN_PATH, now: number = Date.now()): QueuedScan<T> {
    const items = this.list<T>();
    const existing = items.find((item) => item.id === input.idempotencyKey);
    if (existing) return existing;
    const entry: QueuedScan<T> = { id: input.idempotencyKey, input, path, queuedAt: now };
    this.save([...items, entry]);
    return entry;
  }

  remove(id: string) {
    this.save(this.list().filter((item) => item.id !== id));
  }

  get size(): number {
    return this.list().length;
  }
}
