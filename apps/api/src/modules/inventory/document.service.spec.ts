import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { ExtractedGroup } from '@eurohouse/types';
import { NppDocumentService } from './document.service';
import type { OcrProviderPort } from './ocr-provider';
import { fakeGlassPrisma } from './glass-test-fake';

const profile = (id: string, code: string, name: string, systemCode: string, barsPerBundle: number, kgPerMeter = 1.2) => ({ id, code, name, barsPerBundle, kgPerMeter, aluSystem: { code: systemCode, name: systemCode } });

function setup(opts: { provider?: OcrProviderPort; withStorage?: boolean } = {}) {
  const fake = fakeGlassPrisma();
  fake.tables.profiles.push(
    profile('p-ecs01', 'ECS01', 'Khung chấn song hệ 55', 'EU-CS', 2),
    profile('p-ecs03', 'ECS03', 'Nối khung', 'EU-CS', 2),
    profile('p-e70kt', 'E70KT', 'Khung thấp', 'EU-70', 5),
    profile('p-ktl05', 'KTL-05', 'Khung bao 200', 'EU-TL', 1),
  );
  fake.tables.organizations.push({ id: 'fac-1', type: 'FACTORY', name: 'Xưởng Thợ An', phone: '0901', address: 'Q9' });
  const stored: Array<{ mime: string; size: number }> = [];
  const storage = opts.withStorage === false ? undefined : { putUpload: async (input: { buffer: Buffer; mime: string }) => { stored.push({ mime: input.mime, size: input.buffer.byteLength }); return { id: `obj-${stored.length}` }; }, read: async (id: string) => ({ object: { mime: 'image/jpeg', id }, body: Buffer.from('jpegbytes') }) };
  const adjustCalls: Array<{ orgId: string; profileId: string; input: any; ctx: any }> = [];
  const inventory = { adjustNppProfileStock: async (orgId: string, profileId: string, input: unknown, ctx: unknown) => { adjustCalls.push({ orgId, profileId, input, ctx }); return { id: 'm' }; } };
  const provider: OcrProviderPort = opts.provider ?? { configured: false, engine: 'none', extract: async () => { throw new Error('not configured'); } };
  const service = new NppDocumentService(fake.prisma as never, provider, storage as never, inventory as never);
  service.retryDelayMs = 0;
  return { ...fake, service, stored, adjustCalls };
}

const SHEET: ExtractedGroup[] = [
  { heading: 'Xám Ngọc Trai', lines: [{ text: 'Khung bao ôm tường 2 mặt phải mã ECS01', quantity: 4, unit: 'BUNDLE' }, { text: 'Nối tường 10 cm mã ECS03', quantity: 2, unit: 'BUNDLE' }, { text: 'Mô tả lạ không có trong danh mục', quantity: 3, unit: 'BAR' }] },
  { heading: 'Cẩm lai', lines: [{ text: 'K bao thấp', quantity: 2, unit: 'BAR' }] },
];

test('status tells whether automatic reading is available', () => {
  assert.deepEqual(setup().service.status(), { ocrConfigured: false, engine: 'none' });
  const withProvider = setup({ provider: { configured: true, engine: 'qwen3-vl', extract: async () => ({ engine: 'qwen3-vl', groups: [] }) } });
  assert.deepEqual(withProvider.service.status(), { ocrConfigured: true, engine: 'qwen3-vl' });
});

test('a draft from ready-made groups is matched against the catalog, with colours and bars', async () => {
  const { service } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: SHEET });
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.lines.length, 4);
  const [a, b, c, d] = draft.lines;
  assert.equal(a.profileId, 'p-ecs01');
  assert.equal(a.profileCode, 'ECS01');
  assert.equal(a.bars, 8);
  assert.equal(a.colorCode, 'XAM_NGOC_TRAI');
  assert.equal(b.bars, 4);
  assert.equal(c.profileId, null);
  assert.equal(c.colorCode, 'XAM_NGOC_TRAI');
  assert.equal(d.colorCode, 'VAN_GO_CAM_LAI');
  assert.ok(draft.lines.every((l) => l.id));
  assert.equal(draft.engine, 'manual');
});

test('a draft from a photo calls the provider, keeps the image, and records the engine', async () => {
  const calls: unknown[] = [];
  const provider: OcrProviderPort = { configured: true, engine: 'qwen3-vl', extract: async (input) => { calls.push(input); return { engine: 'qwen3-vl', groups: SHEET }; } };
  const { service, stored } = setup({ provider });
  const draft = await service.createDraft('npp-1', 'u', { kind: 'ORDER', imageBase64: Buffer.from('fake-image').toString('base64'), mime: 'image/jpeg' });
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as { kind: string }).kind, 'ORDER');
  assert.equal(draft.engine, 'qwen3-vl');
  assert.equal(draft.hasImage, true);
  assert.equal(stored.length, 1);
  assert.equal(draft.lines.length, 4);
});

test('if reading fails the draft is still created empty so the user can type the lines', async () => {
  const provider: OcrProviderPort = { configured: true, engine: 'qwen3-vl', extract: async () => { throw new Error('GPU đang bận'); } };
  const { service } = setup({ provider });
  const draft = await service.createDraft('npp-1', 'u', { kind: 'ORDER', imageBase64: Buffer.from('x').toString('base64'), mime: 'image/png' });
  assert.equal(draft.lines.length, 0);
  assert.match(draft.note, /GPU đang bận/);
  assert.equal(draft.hasImage, true);
});

test('a photo with no reading service still makes a draft for manual entry', async () => {
  const { service } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'RECEIPT', imageBase64: Buffer.from('x').toString('base64'), mime: 'image/jpeg' });
  assert.equal(draft.lines.length, 0);
  assert.equal(draft.engine, 'manual');
  assert.equal(draft.hasImage, true);
});

test('images are limited to real picture types and a sane size', async () => {
  const { service } = setup();
  await assert.rejects(service.createDraft('npp-1', 'u', { kind: 'ORDER', imageBase64: 'AAAA', mime: 'application/pdf' }), BadRequestException);
  await assert.rejects(service.createDraft('npp-1', 'u', { kind: 'ORDER', imageBase64: 'x'.repeat(14 * 1024 * 1024), mime: 'image/jpeg' }), /quá lớn/);
  await assert.rejects(service.createDraft('npp-1', 'u', { kind: 'BOGUS' as never }), BadRequestException);
});

test('the user chooses a profile for an unmatched line and the shorthand is learned for next time', async () => {
  const { service } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [{ heading: 'Cẩm lai', lines: [{ text: 'ZZ KT', quantity: 6, unit: 'BAR' }] }] });
  assert.equal(draft.lines[0].profileId, null);
  const lineId = draft.lines[0].id;
  const updated = await service.updateDraft('npp-1', draft.id, { lines: [{ id: lineId, group: 'Cẩm lai', text: 'ZZ KT', quantity: 6, unit: 'BAR', profileId: 'p-ktl05' }] });
  assert.equal(updated.lines[0].profileId, 'p-ktl05');
  assert.equal(updated.lines[0].userChosen, true);
  assert.equal(updated.lines[0].confidence, 'HIGH');
  assert.equal(updated.lines[0].bars, 6);
  const next = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [{ heading: 'Cafe Metalic', lines: [{ text: 'ZZ KT', quantity: 2, unit: 'BAR' }] }] });
  assert.equal(next.lines[0].profileId, 'p-ktl05');
  assert.equal(next.lines[0].candidates[0].reason, 'GLOSSARY');
  const other = await service.createDraft('npp-2', 'u', { kind: 'ORDER', groups: [{ heading: '', lines: [{ text: 'ZZ KT', quantity: 2, unit: 'BAR' }] }] });
  assert.notEqual(other.lines[0].candidates[0]?.reason, 'GLOSSARY');
});

test('learning can be switched off, and an auto-matched choice teaches nothing', async () => {
  const { service, tables } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [{ heading: '', lines: [{ text: 'Lạ hoắc', quantity: 1, unit: 'BAR' }, { text: 'mã ECS01', quantity: 1, unit: 'BAR' }] }] });
  await service.updateDraft('npp-1', draft.id, { learn: false, lines: [{ id: draft.lines[0].id, text: 'Lạ hoắc', quantity: 1, unit: 'BAR', profileId: 'p-ecs03' }, { id: draft.lines[1].id, text: 'mã ECS01', quantity: 1, unit: 'BAR', profileId: 'p-ecs01' }] });
  assert.equal(tables.glossary.length, 0);
  await service.updateDraft('npp-1', draft.id, { lines: [{ id: draft.lines[0].id, text: 'Lạ hoắc', quantity: 1, unit: 'BAR', profileId: 'p-ecs03' }, { id: draft.lines[1].id, text: 'mã ECS01', quantity: 1, unit: 'BAR', profileId: 'p-ecs01' }] });
  assert.deepEqual(tables.glossary.map((g) => g.term), ['la hoac']);
});

test('editing lines recalculates bars, can clear a choice and can remove or add lines', async () => {
  const { service } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [{ heading: '', lines: [{ text: 'mã ECS01', quantity: 4, unit: 'BUNDLE' }] }] });
  const id = draft.lines[0].id;
  const more = await service.updateDraft('npp-1', draft.id, { lines: [{ id, text: 'mã ECS01', quantity: 5, unit: 'BUNDLE' }, { text: 'mã E70KT', quantity: 2, unit: 'BAR' }] });
  assert.equal(more.lines[0].bars, 10);
  assert.equal(more.lines.length, 2);
  assert.equal(more.lines[1].profileId, 'p-e70kt');
  const cleared = await service.updateDraft('npp-1', draft.id, { lines: [{ id, text: 'mã ECS01', quantity: 5, unit: 'BUNDLE', profileId: null }, { id: more.lines[1].id, text: 'mã E70KT', quantity: 2, unit: 'BAR', removed: true }] });
  assert.equal(cleared.lines[0].profileId, null);
  assert.equal(cleared.lines[0].bars, null);
  assert.equal(cleared.lines[1].removed, true);
  await assert.rejects(service.updateDraft('npp-1', draft.id, { lines: [{ id, text: 'x', quantity: 1, unit: 'BAR', profileId: 'no-such-profile' }] }), BadRequestException);
});

test('the order input has every active line resolved, per-line colours, the factory and a stable request id', async () => {
  const { service } = setup();
  const created = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: SHEET.map((g) => ({ ...g, lines: g.lines.filter((l) => !l.text.startsWith('Mô tả')) })), factoryOrgId: 'fac-1' });
  await assert.rejects(service.buildOrderInput('npp-1', created.id), /Dòng 3: máy mới chỉ đoán/);
  // người dùng xem lại dòng "K bao thấp" (máy chỉ đoán theo tên) và xác nhận đúng thanh đó
  const draft = await service.updateDraft('npp-1', created.id, { lines: created.lines.map((l) => ({ id: l.id, group: l.group, text: l.text, quantity: l.quantity, unit: l.unit, ...(l.confidence !== 'HIGH' && l.profileId ? { profileId: l.profileId } : {}) })) });
  assert.equal(draft.lines[2].userChosen, true);
  const input = await service.buildOrderInput('npp-1', draft.id);
  assert.equal(input.sourceType, 'NPP');
  assert.equal(input.factoryOrgId, 'fac-1');
  assert.equal(input.clientRequestId, `doc-${draft.id}`);
  assert.equal(input.customerName, 'Xưởng Thợ An');
  assert.deepEqual(input.items.map((i) => [i.productCode, i.quantity, i.colorCode]), [['ECS01', 8, 'XAM_NGOC_TRAI'], ['ECS03', 4, 'XAM_NGOC_TRAI'], ['E70KT', 2, 'VAN_GO_CAM_LAI']]);
  assert.equal(input.items[0].profileId, 'p-ecs01');
  assert.equal(input.items[0].kgPerMeter, 1.2);
});

test('the order input refuses unresolved lines, a missing factory, an unknown factory, and the wrong kind', async () => {
  const { service } = setup();
  const unresolved = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: SHEET, factoryOrgId: 'fac-1' });
  await assert.rejects(service.buildOrderInput('npp-1', unresolved.id), /Dòng 3/);
  const noFactory = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [{ heading: 'Cẩm lai', lines: [{ text: 'mã ECS01', quantity: 1, unit: 'BAR' }] }] });
  await assert.rejects(service.buildOrderInput('npp-1', noFactory.id), /xưởng/i);
  const unknown = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [{ heading: 'Cẩm lai', lines: [{ text: 'mã ECS01', quantity: 1, unit: 'BAR' }] }], factoryOrgId: 'nope' });
  await assert.rejects(service.buildOrderInput('npp-1', unknown.id), NotFoundException);
  const receipt = await service.createDraft('npp-1', 'u', { kind: 'RECEIPT', groups: [{ heading: 'Xám Ngọc Trai', lines: [{ text: 'mã ECS01', quantity: 1, unit: 'BAR' }] }] });
  await assert.rejects(service.buildOrderInput('npp-1', receipt.id), BadRequestException);
});

test('a lines with no colour blocks the order, and removed lines do not', async () => {
  const { service } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [{ heading: '', lines: [{ text: 'mã ECS01', quantity: 1, unit: 'BAR' }, { text: 'Lạ hoắc', quantity: 1, unit: 'BAR' }] }], factoryOrgId: 'fac-1' });
  await assert.rejects(service.buildOrderInput('npp-1', draft.id), /màu/i);
  const fixed = await service.updateDraft('npp-1', draft.id, { lines: [{ id: draft.lines[0].id, text: 'mã ECS01', quantity: 1, unit: 'BAR', colorCode: 'CAFE_THUONG' }, { id: draft.lines[1].id, text: 'Lạ hoắc', quantity: 1, unit: 'BAR', removed: true }] });
  assert.equal(fixed.lines[0].colorCode, 'CAFE_THUONG');
  const input = await service.buildOrderInput('npp-1', draft.id);
  assert.equal(input.items.length, 1);
});

test('confirming an order marks the draft once; a rejected draft cannot be confirmed', async () => {
  const { service } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [{ heading: 'Cẩm lai', lines: [{ text: 'mã ECS01', quantity: 1, unit: 'BAR' }] }], factoryOrgId: 'fac-1' });
  const done = await service.confirmOrder('npp-1', 'u', draft.id, { resultRef: 'DH-001' });
  assert.equal(done.status, 'CONFIRMED');
  assert.equal(done.resultRef, 'DH-001');
  assert.equal((await service.confirmOrder('npp-1', 'u', draft.id, { resultRef: 'DH-OTHER' })).resultRef, 'DH-001');
  const rejected = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [] });
  assert.equal((await service.reject('npp-1', rejected.id)).status, 'REJECTED');
  await assert.rejects(service.confirmOrder('npp-1', 'u', rejected.id, { resultRef: 'X' }), /đã bị bỏ/);
  await assert.rejects(service.updateDraft('npp-1', rejected.id, { lines: [] }), /không còn là bản nháp/);
});

test('confirming a receipt adds each line to the NPP profile stock once, with stable idempotency keys', async () => {
  const { service, adjustCalls } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'RECEIPT', groups: [{ heading: 'Xám Ngọc Trai', lines: [{ text: 'mã ECS01', quantity: 4, unit: 'BUNDLE' }, { text: 'mã E70KT', quantity: 3, unit: 'BAR' }] }] });
  const done = await service.confirmReceipt('npp-1', 'u', draft.id);
  assert.equal(done.status, 'CONFIRMED');
  assert.equal(adjustCalls.length, 2);
  assert.deepEqual(adjustCalls.map((c) => [c.profileId, c.input.direction, c.input.quantity, c.input.colorCode]), [['p-ecs01', 'IN', 8, 'XAM_NGOC_TRAI'], ['p-e70kt', 'IN', 3, 'XAM_NGOC_TRAI']]);
  assert.equal(adjustCalls[0].ctx.ownerType, 'NPP_STOCK');
  assert.equal(adjustCalls[0].ctx.ownerId, 'npp-1');
  assert.ok(adjustCalls[0].ctx.idempotencyKey.length >= 8);
  assert.notEqual(adjustCalls[0].ctx.idempotencyKey, adjustCalls[1].ctx.idempotencyKey);
  assert.equal((await service.confirmReceipt('npp-1', 'u', draft.id)).status, 'CONFIRMED');
  assert.equal(adjustCalls.length, 2, 'a second confirm does not add stock again');
});

test('a receipt that failed half way can be retried with the same keys', async () => {
  const { service, adjustCalls } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'RECEIPT', groups: [{ heading: 'Xám Ngọc Trai', lines: [{ text: 'mã ECS01', quantity: 1, unit: 'BAR' }, { text: 'mã E70KT', quantity: 1, unit: 'BAR' }] }] });
  let fail = true;
  (service as unknown as { inventory: { adjustNppProfileStock: (...a: unknown[]) => Promise<unknown> } }).inventory.adjustNppProfileStock = async (orgId: string, profileId: string, input: unknown, ctx: unknown) => {
    adjustCalls.push({ orgId, profileId, input, ctx } as never);
    if (profileId === 'p-e70kt' && fail) throw new ConflictException('kho đang bận');
    return { id: 'm' };
  };
  await assert.rejects(service.confirmReceipt('npp-1', 'u', draft.id), ConflictException);
  assert.equal((await service.getDraft('npp-1', draft.id)).status, 'DRAFT');
  fail = false;
  const done = await service.confirmReceipt('npp-1', 'u', draft.id);
  assert.equal(done.status, 'CONFIRMED');
  const keysFirstLine = adjustCalls.filter((c) => c.profileId === 'p-ecs01').map((c) => c.ctx.idempotencyKey);
  assert.equal(new Set(keysFirstLine).size, 1, 'retry reuses the same key for the line that already succeeded');
});

test('a receipt refuses unresolved lines and the wrong kind', async () => {
  const { service } = setup();
  const unresolved = await service.createDraft('npp-1', 'u', { kind: 'RECEIPT', groups: [{ heading: 'Xám Ngọc Trai', lines: [{ text: 'Lạ hoắc', quantity: 1, unit: 'BAR' }] }] });
  await assert.rejects(service.confirmReceipt('npp-1', 'u', unresolved.id), /Dòng 1/);
  const order = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [] });
  await assert.rejects(service.confirmReceipt('npp-1', 'u', order.id), BadRequestException);
});

test('drafts are scoped to the NPP and the image is only served to its owner', async () => {
  const { service } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'ORDER', imageBase64: Buffer.from('x').toString('base64'), mime: 'image/jpeg' });
  await assert.rejects(service.getDraft('npp-2', draft.id), NotFoundException);
  await assert.rejects(service.updateDraft('npp-2', draft.id, { lines: [] }), NotFoundException);
  await assert.rejects(service.readImage('npp-2', draft.id), NotFoundException);
  assert.equal((await service.listDrafts('npp-2')).length, 0);
  assert.equal((await service.listDrafts('npp-1')).length, 1);
  const image = await service.readImage('npp-1', draft.id);
  assert.equal(image.mime, 'image/jpeg');
  assert.equal(image.body.toString(), 'jpegbytes');
  const noImage = await service.createDraft('npp-1', 'u', { kind: 'ORDER', groups: [] });
  await assert.rejects(service.readImage('npp-1', noImage.id), /không có ảnh/);
});

test('a line the machine only guessed by name blocks a receipt until the user confirms it', async () => {
  const { service, adjustCalls } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'RECEIPT', groups: [{ heading: 'Xám Ngọc Trai', lines: [{ text: 'K bao thấp', quantity: 2, unit: 'BAR' }] }] });
  assert.equal(draft.lines[0].profileId, 'p-e70kt');
  assert.equal(draft.lines[0].confidence, 'MEDIUM');
  await assert.rejects(service.confirmReceipt('npp-1', 'u', draft.id), /máy mới chỉ đoán/);
  assert.equal(adjustCalls.length, 0);
  const confirmed = await service.updateDraft('npp-1', draft.id, { lines: [{ id: draft.lines[0].id, group: 'Xám Ngọc Trai', text: 'K bao thấp', quantity: 2, unit: 'BAR', profileId: 'p-e70kt' }] });
  assert.equal(confirmed.lines[0].userChosen, true);
  assert.equal((await service.confirmReceipt('npp-1', 'u', draft.id)).status, 'CONFIRMED');
  assert.equal(adjustCalls.length, 1);
});

test('a receipt confirm that collides with a concurrent one is retried with the same key and succeeds', async () => {
  const { service, adjustCalls } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'RECEIPT', groups: [{ heading: 'Xám Ngọc Trai', lines: [{ text: 'mã ECS01', quantity: 2, unit: 'BAR' }] }] });
  let failures = 2;
  (service as unknown as { inventory: { adjustNppProfileStock: (...a: unknown[]) => Promise<unknown> } }).inventory.adjustNppProfileStock = async (orgId: string, profileId: string, input: unknown, ctx: unknown) => {
    adjustCalls.push({ orgId, profileId, input, ctx } as never);
    if (failures-- > 0) throw new ConflictException('The inventory command is already in progress.');
    return { id: 'm' };
  };
  const done = await service.confirmReceipt('npp-1', 'u', draft.id);
  assert.equal(done.status, 'CONFIRMED');
  assert.equal(adjustCalls.length, 3);
  assert.equal(new Set(adjustCalls.map((c) => c.ctx.idempotencyKey)).size, 1);
});

test('a real error (not a collision) is not retried', async () => {
  const { service, adjustCalls } = setup();
  const draft = await service.createDraft('npp-1', 'u', { kind: 'RECEIPT', groups: [{ heading: 'Xám Ngọc Trai', lines: [{ text: 'mã ECS01', quantity: 2, unit: 'BAR' }] }] });
  (service as unknown as { inventory: { adjustNppProfileStock: (...a: unknown[]) => Promise<unknown> } }).inventory.adjustNppProfileStock = async () => { adjustCalls.push({} as never); throw new BadRequestException('Số lượng không hợp lệ'); };
  await assert.rejects(service.confirmReceipt('npp-1', 'u', draft.id), BadRequestException);
  assert.equal(adjustCalls.length, 1);
});
