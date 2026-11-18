import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import { TaxInvoiceService } from './tax-invoice.service';

const owner: JwtUser = { sub: 'u1', displayName: 'Chủ xưởng', role: 'FACTORY', organizationId: 'org-1' };
const other: JwtUser = { sub: 'u2', displayName: 'Xưởng khác', role: 'FACTORY', organizationId: 'org-2' };

type Row = Record<string, any>;

/** Prisma giả, lưu trong bộ nhớ, đủ cho các truy vấn của TaxInvoiceService. */
function fakePrisma(seed: { profile?: Row | null; receipts?: Row[]; project?: Row | null; quotation?: Row | null } = {}) {
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const invoices: Row[] = [];
  const lines: Row[] = [];
  const events: Row[] = [];
  let profile: Row | null = seed.profile === undefined ? null : seed.profile;
  const calls: Record<string, any[]> = { receipts: [] };

  const matches = (row: Row, where: Row = {}): boolean => Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true;
    if (k === 'OR') return (v as Row[]).some((w) => matches(row, w));
    if (k === 'NOT') return !matches(row, v);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return (v.in as unknown[]).includes(row[k]);
      if ('not' in v) return row[k] !== v.not;
      if ('gte' in v || 'lt' in v) return (!v.gte || row[k] >= v.gte) && (!v.lt || row[k] < v.lt);
      if ('contains' in v) return String(row[k] ?? '').toLowerCase().includes(String(v.contains).toLowerCase());
    }
    return row[k] === v;
  });
  const hydrate = (row: Row) => ({
    ...row,
    lines: lines.filter((l) => l.invoiceId === row.id).sort((a, b) => a.position - b.position),
    events: events.filter((e) => e.invoiceId === row.id),
    replaces: row.replacesId ? invoices.find((i) => i.id === row.replacesId) ?? null : null,
    replacedBy: invoices.filter((i) => i.replacesId === row.id),
    _count: { lines: lines.filter((l) => l.invoiceId === row.id).length },
  });

  const prisma: any = {
    calls,
    invoices,
    workshopTaxProfile: {
      findUnique: async () => profile,
      upsert: async ({ create, update }: Row) => {
        for (const key of ['updatedAt', 'createdAt', 'id']) if (key in create) throw new Error(`Prisma không nhận ${key} khi tạo hồ sơ thuế`); profile = profile ? { ...profile, ...update, updatedAt: new Date() } : { ...create, updatedAt: new Date() }; return profile; },
    },
    workshopSalesInvoice: {
      findFirst: async ({ where, orderBy }: Row) => {
        let rows = invoices.filter((r) => matches(r, where));
        if (orderBy?.number === 'desc') rows = rows.sort((a, b) => String(b.number).localeCompare(String(a.number)));
        return rows[0] ? hydrate(rows[0]) : null;
      },
      findMany: async ({ where }: Row) => invoices.filter((r) => matches(r, where)).map(hydrate),
      count: async ({ where }: Row) => invoices.filter((r) => matches(r, where)).length,
      create: async ({ data }: Row) => {
        const { lines: lineData, events: eventData, ...rest } = data;
        const row = { id: id('inv'), number: null, replacesId: null, lookupCode: null, providerRef: null, provider: null, issuedAt: null, cancelledAt: null, cancelReason: '', createdAt: new Date(), ...rest };
        invoices.push(row);
        for (const [i, l] of (lineData?.create ?? []).entries()) lines.push({ id: id('line'), invoiceId: row.id, position: i, ...l });
        for (const e of eventData?.create ? [eventData.create].flat() : []) events.push({ invoiceId: row.id, createdAt: new Date(), ...e });
        return hydrate(row);
      },
      update: async ({ where, data }: Row) => {
        const row = invoices.find((r) => r.id === where.id)!;
        const { lines: lineData, events: eventData, ...rest } = data;
        if (rest.number && invoices.some((r) => r !== row && r.organizationId === row.organizationId && r.series === (rest.series ?? row.series) && r.number === rest.number)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        Object.assign(row, rest);
        if (lineData?.deleteMany) for (let i = lines.length - 1; i >= 0; i--) if (lines[i].invoiceId === row.id) lines.splice(i, 1);
        for (const [i, l] of (lineData?.create ?? []).entries()) lines.push({ id: id('line'), invoiceId: row.id, position: i, ...l });
        for (const e of eventData?.create ? [eventData.create].flat() : []) events.push({ invoiceId: row.id, createdAt: new Date(), ...e });
        return hydrate(row);
      },
      delete: async ({ where }: Row) => { invoices.splice(invoices.findIndex((r) => r.id === where.id), 1); },
    },
    cashTransaction: {
      findMany: async (args: Row) => { calls.receipts.push(args); return seed.receipts ?? []; },
      aggregate: async () => ({ _sum: { amount: 50_000_000 } }),
    },
    project: { findFirst: async ({ where }: Row) => (seed.project && seed.project.organizationId === where.organizationId && seed.project.id === where.id ? seed.project : null) },
    quotation: { findUnique: async () => seed.quotation ?? null },
    workshopCustomer: { findFirst: async () => null },
    organization: { findUnique: async () => ({ name: 'Xưởng Nhôm Kính An Phát', address: '', phone: '' }) },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return prisma;
}

const fullProfile = {
  organizationId: 'org-1', entityType: 'HKD', taxCode: '8312456789', legalName: 'Hộ KD Nhôm Kính An Phát', legalAddress: '', locationCode: '',
  businessLine: 'MANUFACTURING', vatRatePct: null, pitRatePct: null, pitMethod: 'REVENUE_RATE', invoiceSeries: '1C26TAP', provider: 'SANDBOX', einvoiceRegisteredAt: null,
};

const draftInput = { buyerName: 'Nguyễn Thị Lan', issueDate: '2026-11-18', lines: [{ name: 'Cửa đi mở quay', unit: 'bộ', quantity: 2, unitPrice: 10_000_000 }] };

test('hồ sơ chưa có: trả mặc định hộ kinh doanh, chưa đủ để phát hành', async () => {
  const service = new TaxInvoiceService(fakePrisma());
  const profile = await service.profile(owner);
  assert.equal(profile.entityType, 'HKD');
  assert.equal(profile.provider, 'NONE');
  assert.equal(profile.isComplete, false);
  assert.equal(profile.defaults.exemptThreshold, 1_000_000_000);
  assert.equal(profile.defaults.vatPct, 3);
});

test('hồ sơ: kiểm tra mã số thuế, chưa cho chọn MISA', async () => {
  const service = new TaxInvoiceService(fakePrisma());
  await assert.rejects(() => service.updateProfile(owner, { taxCode: '12345' }), /Mã số thuế/);
  await assert.rejects(() => service.updateProfile(owner, { provider: 'MISA' }), /MISA/);
  const saved = await service.updateProfile(owner, { taxCode: '8312456789', legalName: 'Hộ KD An Phát', invoiceSeries: '1c26tap', provider: 'SANDBOX' });
  assert.equal(saved.invoiceSeries, '1C26TAP');
  assert.equal(saved.isComplete, true);
});

test('lập nháp: hộ kinh doanh luôn không tách GTGT, tổng theo dòng', async () => {
  const service = new TaxInvoiceService(fakePrisma({ profile: fullProfile }));
  const draft = await service.createInvoice(owner, { ...draftInput, vatRatePct: 10 });
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.vatRatePct, 0);
  assert.equal(draft.total, 20_000_000);
  assert.equal(draft.series, '1C26TAP');
  assert.equal(draft.number, null);
  assert.equal(draft.events[0].action, 'CREATED');
});

test('phát hành Bản thử: cấp số tiếp theo theo ký hiệu, ghi nhật ký, không sửa được nữa', async () => {
  const prisma = fakePrisma({ profile: fullProfile });
  const service = new TaxInvoiceService(prisma);
  const a = await service.createInvoice(owner, draftInput);
  const b = await service.createInvoice(owner, draftInput);
  const issuedA = await service.issue(owner, a.id);
  const issuedB = await service.issue(owner, b.id);
  assert.equal(issuedA.number, '00000001');
  assert.equal(issuedB.number, '00000002');
  assert.equal(issuedA.status, 'ISSUED');
  assert.equal(issuedA.provider, 'SANDBOX');
  assert.match(issuedA.lookupCode ?? '', /^TEST-/);
  assert.ok(issuedA.events.some((e) => e.action === 'ISSUED'));
  await assert.rejects(() => service.updateInvoice(owner, a.id, draftInput), /nháp/);
  await assert.rejects(() => service.deleteInvoice(owner, a.id), /nháp/);
  await assert.rejects(() => service.issue(owner, a.id), /nháp/);
});

test('phát hành: chưa chọn nhà cung cấp hoặc thiếu hồ sơ thì báo rõ', async () => {
  const none = new TaxInvoiceService(fakePrisma({ profile: { ...fullProfile, provider: 'NONE' } }));
  const d1 = await none.createInvoice(owner, draftInput);
  await assert.rejects(() => none.issue(owner, d1.id), /nhà cung cấp/);

  const empty = new TaxInvoiceService(fakePrisma({ profile: { ...fullProfile, taxCode: '' } }));
  const d2 = await empty.createInvoice(owner, draftInput);
  await assert.rejects(() => empty.issue(owner, d2.id), (e: unknown) => e instanceof BadRequestException && /mã số thuế/.test(e.message));
});

test('ghi số đã xuất ngoài: cần số, không trùng số trong cùng ký hiệu', async () => {
  const service = new TaxInvoiceService(fakePrisma({ profile: { ...fullProfile, provider: 'NONE' } }));
  const a = await service.createInvoice(owner, draftInput);
  const b = await service.createInvoice(owner, draftInput);
  await assert.rejects(() => service.recordExternal(owner, a.id, { series: '1C26TAP', number: '' }), /số hoá đơn/);
  const rec = await service.recordExternal(owner, a.id, { series: '1c26tap', number: '148', issueDate: '2026-11-18' });
  assert.equal(rec.status, 'ISSUED');
  assert.equal(rec.source, 'EXTERNAL');
  assert.equal(rec.number, '00000148');
  await assert.rejects(() => service.recordExternal(owner, b.id, { series: '1C26TAP', number: '00000148' }), /đã dùng/);
});

test('huỷ cần lý do; thay thế lập nháp mới, phát hành xong thì hoá đơn cũ thành REPLACED', async () => {
  const service = new TaxInvoiceService(fakePrisma({ profile: fullProfile }));
  const a = await service.issue(owner, (await service.createInvoice(owner, draftInput)).id);
  await assert.rejects(() => service.cancel(owner, a.id, ''), /lý do/);
  const replacement = await service.replace(owner, a.id);
  assert.equal(replacement.status, 'DRAFT');
  assert.equal(replacement.replacesId, a.id);
  assert.equal(replacement.lines.length, 1);
  await assert.rejects(() => service.replace(owner, a.id), /đang có hoá đơn thay thế/);
  const issued = await service.issue(owner, replacement.id);
  assert.equal(issued.replacesNumber, '00000001');
  const old = await service.invoice(owner, a.id);
  assert.equal(old.status, 'REPLACED');
  assert.equal(old.replacedByNumber, '00000002');

  const b = await service.issue(owner, (await service.createInvoice(owner, draftInput)).id);
  const cancelled = await service.cancel(owner, b.id, 'Khách huỷ đơn');
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(cancelled.cancelReason, 'Khách huỷ đơn');
  await assert.rejects(() => service.cancel(owner, b.id, 'lần nữa'), /đã phát hành/);
});

test('xưởng khác không thấy hoá đơn', async () => {
  const service = new TaxInvoiceService(fakePrisma({ profile: fullProfile }));
  const a = await service.createInvoice(owner, draftInput);
  await assert.rejects(() => service.invoice(other, a.id), NotFoundException);
});

test('lập từ công trình: lấy khách và dòng từ báo giá, thêm dòng chi phí còn lại', async () => {
  const service = new TaxInvoiceService(fakePrisma({
    profile: fullProfile,
    project: { id: 'p1', organizationId: 'org-1', code: 'CT-261020', name: 'Nhà chị Lan', customerName: 'Nguyễn Thị Lan', customerPhone: '0909', address: 'Q7', quotationId: 'q1', settledValue: 0, contractValue: 70_000_000, extraRevenue: 0, estimatedValue: 0, customerV2Id: null },
    quotation: { id: 'q1', totalAmount: 68_420_000, vatAmount: 0, items: [
      { name: 'D1', doorType: 'Cửa đi mở quay', system: 'Hệ 55', widthMm: 1200, heightMm: 2200, quantity: 2, totalPrice: 35_340_000 },
      { name: 'S1', doorType: 'Cửa sổ lùa', system: '', widthMm: 1400, heightMm: 1400, quantity: 1, totalPrice: 23_040_000 },
    ] },
  }));
  const draft = await service.createFromProject(owner, 'p1');
  assert.equal(draft.buyerName, 'Nguyễn Thị Lan');
  assert.equal(draft.projectCode, 'CT-261020');
  assert.equal(draft.lines.length, 3);
  assert.equal(draft.lines[0].name, 'Cửa đi mở quay Hệ 55 · D1 · 1200×2200 mm');
  assert.equal(draft.lines[0].quantity, 2);
  assert.equal(draft.lines[0].unitPrice, 17_670_000);
  assert.equal(draft.lines[2].amount, 10_040_000);
  assert.equal(draft.total, 68_420_000);
  await assert.rejects(() => service.createFromProject(other, 'p1'), NotFoundException);
});

test('sổ năm: lọc phiếu thu theo công trình của xưởng, đếm nháp, tính thuế dự phóng', async () => {
  const prisma = fakePrisma({ profile: fullProfile, receipts: [{ transDate: new Date('2026-03-02T03:00:00Z'), amount: 40_000_000 }] });
  const service = new TaxInvoiceService(prisma, () => new Date('2026-07-02T03:00:00Z'));
  const a = await service.createInvoice(owner, { ...draftInput, issueDate: '2026-03-01', lines: [{ name: 'Cửa', quantity: 1, unitPrice: 600_000_000 }] });
  await service.issue(owner, a.id);
  await service.createInvoice(owner, draftInput);
  const ledger = await service.ledger(owner, 2026);
  assert.equal(prisma.calls.receipts[0].where.project.organizationId, 'org-1');
  assert.equal(prisma.calls.receipts[0].where.type, 'RECEIPT');
  assert.equal(ledger.totalInvoiced, 600_000_000);
  assert.equal(ledger.totalCollected, 40_000_000);
  assert.equal(ledger.draftCount, 1);
  assert.equal(ledger.tax.exempt, true);
  assert.ok(ledger.projectedYearRevenue! > 1_000_000_000);
  assert.equal(ledger.projectedTax?.exempt, false);
  assert.equal(ledger.profile.isComplete, true);
});
