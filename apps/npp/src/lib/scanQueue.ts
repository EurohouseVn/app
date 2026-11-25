import type { ScanGlassStockInput } from '@eurohouse/types';

/**
 * Hàng đợi quét khi mất mạng: mỗi lần quét đã có idempotencyKey riêng nên gửi lại sau không bị cộng hoặc trừ hai lần.
 * Lưu trong localStorage của điện thoại, tối đa 500 lần quét.
 */
export type QueuedScan = { id: string; input: ScanGlassStockInput; queuedAt: number };

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const SCAN_QUEUE_KEY = 'eurohouse-npp-scan-queue';
export const SCAN_QUEUE_MAX = 500;

export class ScanQueue {
  constructor(private readonly store: Store, private readonly key: string = SCAN_QUEUE_KEY) {}

  list(): QueuedScan[] {
    try {
      const parsed = JSON.parse(this.store.getItem(this.key) ?? '[]') as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is QueuedScan => !!item && typeof (item as QueuedScan).id === 'string' && !!(item as QueuedScan).input);
    } catch {
      return [];
    }
  }

  private save(items: QueuedScan[]) {
    this.store.setItem(this.key, JSON.stringify(items.slice(-SCAN_QUEUE_MAX)));
  }

  /** Thêm một lần quét; cùng idempotencyKey thì không thêm lần hai. */
  add(input: ScanGlassStockInput, now: number = Date.now()): QueuedScan {
    const items = this.list();
    const existing = items.find((item) => item.id === input.idempotencyKey);
    if (existing) return existing;
    const entry: QueuedScan = { id: input.idempotencyKey, input, queuedAt: now };
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
