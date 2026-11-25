/**
 * Prisma giả trong bộ nhớ cho test dịch vụ kính: đủ bảng mã đầu, tồn kính, sổ nhập xuất, phương án cắt.
 * Giao dịch có hoàn tác như Postgres thật; afterRollback chèn các dòng của "yêu cầu khác đã chốt" sau khi hoàn tác
 * để mô phỏng đua tranh. Chỉ dùng trong test.
 */
type Row = Record<string, any>;

function matchValue(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    const op = expected as Row;
    if ('in' in op) return (op.in as unknown[]).includes(actual);
    if ('gt' in op) return (actual as number) > op.gt;
    if ('gte' in op) return (actual as number) >= op.gte;
    if ('not' in op) return actual !== op.not;
    if ('startsWith' in op) return String(actual).startsWith(op.startsWith);
  }
  return expected === undefined || actual === expected;
}

const matches = (row: Row, where: Row = {}) => Object.entries(where).every(([key, value]) => matchValue(row[key], value));

export function fakeGlassPrisma() {
  const hooks: { afterRollback: (() => void) | null } = { afterRollback: null };
  const tables = {
    schemes: [] as Row[],
    stocks: [] as Row[],
    moves: [] as Row[],
    plans: [] as Row[],
  };
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}${++seq}`;
  const now = () => new Date();
  const unique = (message = 'Unique constraint failed') => Object.assign(new Error(message), { code: 'P2002' });

  function applyData(row: Row, data: Row) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !(value instanceof Date) && ('increment' in (value as Row) || 'decrement' in (value as Row))) {
        const op = value as Row;
        row[key] += 'increment' in op ? op.increment : -op.decrement;
      } else row[key] = value;
    }
    row.updatedAt = now();
  }

  const prisma: Row = {
    nppBarcodeScheme: {
      findMany: async ({ where }: Row) => tables.schemes.filter((r) => matches(r, where)),
      findFirst: async ({ where }: Row) => tables.schemes.find((r) => matches(r, where)) ?? null,
      create: async ({ data }: Row) => {
        if (tables.schemes.some((r) => r.nppOrgId === data.nppOrgId && r.prefix === data.prefix)) throw unique();
        const row = { id: nextId('sch'), label: '', glassType: '', thicknessMm: null, active: true, createdAt: now(), updatedAt: now(), ...data };
        tables.schemes.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => {
        const row = tables.schemes.find((r) => r.id === where.id)!;
        applyData(row, data);
        return row;
      },
    },
    nppGlassSheet: {
      findMany: async ({ where }: Row) => tables.stocks.filter((r) => matches(r, where)),
      findFirst: async ({ where }: Row) => tables.stocks.find((r) => matches(r, where)) ?? null,
      findUnique: async ({ where }: Row) => {
        if (where.id) return tables.stocks.find((r) => r.id === where.id) ?? null;
        const k = where.nppOrgId_barcode_kind_location;
        return tables.stocks.find((r) => r.nppOrgId === k.nppOrgId && r.barcode === k.barcode && r.kind === k.kind && r.location === k.location) ?? null;
      },
      create: async ({ data }: Row) => {
        if (tables.stocks.some((r) => r.nppOrgId === data.nppOrgId && r.barcode === data.barcode && r.kind === data.kind && r.location === data.location)) throw unique();
        const row = { id: nextId('stk'), note: '', unitCost: 0, quantity: 0, createdAt: now(), updatedAt: now(), ...data };
        tables.stocks.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => {
        const row = tables.stocks.find((r) => r.id === where.id)!;
        applyData(row, data);
        return row;
      },
      updateMany: async ({ where, data }: Row) => {
        const rows = tables.stocks.filter((r) => matches(r, where));
        rows.forEach((row) => applyData(row, data));
        return { count: rows.length };
      },
    },
    nppGlassMovement: {
      findUnique: async ({ where }: Row) => {
        const k = where.nppOrgId_idempotencyKey;
        return tables.moves.find((r) => r.nppOrgId === k.nppOrgId && r.idempotencyKey === k.idempotencyKey) ?? null;
      },
      create: async ({ data }: Row) => {
        if (tables.moves.some((r) => r.nppOrgId === data.nppOrgId && r.idempotencyKey === data.idempotencyKey)) throw unique();
        const row = { id: nextId('mov'), createdAt: now(), reason: '', ...data };
        tables.moves.push(row);
        return row;
      },
    },
    nppCutPlan: {
      create: async ({ data }: Row) => {
        const row = { id: nextId('plan'), status: 'DRAFT', orderRef: '', note: '', confirmedAt: null, confirmedById: null, createdAt: now(), updatedAt: now(), ...data };
        tables.plans.push(row);
        return row;
      },
      findFirst: async ({ where }: Row) => tables.plans.find((r) => matches(r, where)) ?? null,
      findMany: async ({ where, take }: Row) => tables.plans.filter((r) => matches(r, where)).slice().reverse().slice(0, take ?? 1000),
      update: async ({ where, data }: Row) => {
        const row = tables.plans.find((r) => r.id === where.id)!;
        applyData(row, data);
        return row;
      },
      updateMany: async ({ where, data }: Row) => {
        const rows = tables.plans.filter((r) => matches(r, where));
        rows.forEach((row) => applyData(row, data));
        return { count: rows.length };
      },
    },
    $transaction: async (fn: (tx: Row) => unknown) => {
      const snapshot = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.map((r) => ({ ...r }))])) as Record<string, Row[]>;
      try {
        return await fn(prisma);
      } catch (error) {
        for (const [name, rows] of Object.entries(snapshot)) (tables as Record<string, Row[]>)[name].splice(0, (tables as Record<string, Row[]>)[name].length, ...rows);
        const hook = hooks.afterRollback;
        hooks.afterRollback = null;
        hook?.();
        throw error;
      }
    },
  };
  return { prisma, tables, hooks, unique };
}
