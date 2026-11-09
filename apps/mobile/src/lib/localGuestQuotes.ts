export const GUEST_QUOTES_KEY = '@eurohouse_guest_quotes_v1';

export type GuestQuoteItem = { description: string; quantity: number; unitPrice: number; amount: number };
export type GuestQuote = {
  id: string;
  customerName: string;
  items: GuestQuoteItem[];
  total: number;
  createdAt: string;
};

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function key(installationId: string) {
  return `${GUEST_QUOTES_KEY}:guest_${installationId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function calculateGuestQuote(items: Array<Omit<GuestQuoteItem, 'amount'>>) {
  const normalized = items.map((item) => ({
    description: item.description.trim(),
    quantity: Math.max(0, Number(item.quantity) || 0),
    unitPrice: Math.max(0, Number(item.unitPrice) || 0),
    amount: Math.round(Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0)),
  }));
  return { items: normalized, total: normalized.reduce((sum, item) => sum + item.amount, 0) };
}

export async function listGuestQuotes(storage: Storage, installationId: string): Promise<GuestQuote[]> {
  try {
    const parsed = JSON.parse((await storage.getItem(key(installationId))) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveGuestQuote(
  storage: Storage,
  installationId: string,
  input: Omit<GuestQuote, 'id' | 'createdAt'>,
  createId: () => string = () => `quote-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
): Promise<GuestQuote> {
  const quote = { ...input, id: createId(), createdAt: new Date().toISOString() };
  await storage.setItem(key(installationId), JSON.stringify([quote, ...(await listGuestQuotes(storage, installationId))]));
  return quote;
}
