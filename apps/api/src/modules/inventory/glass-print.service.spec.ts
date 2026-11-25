import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NppPrintService, STATION_ONLINE_MS, STALE_CLAIM_MS } from './glass-print.service';
import { fakeGlassPrisma } from './glass-test-fake';

const label = (barcode = 'CL8-0600-0900', over: Record<string, unknown> = {}) => ({ barcode, widthMm: 600, heightMm: 900, glassType: 'Cường lực 8 ly', location: 'Kệ A1', kindLabel: 'Tấm dư', ...over });

function setup() {
  const fake = fakeGlassPrisma();
  return { ...fake, service: new NppPrintService(fake.prisma as never) };
}

test('enqueue stores a QUEUED job and reports whether a station is online', async () => {
  const { service, tables } = setup();
  const first = await service.enqueue('npp-1', 'u', 'phone-1', { labels: [label(), label()] });
  assert.equal(first.status, 'QUEUED');
  assert.equal(first.labelCount, 2);
  assert.equal(first.stationOnline, false);
  assert.equal(tables.printJobs.length, 1);
  await service.poll('npp-1', 'desktop-1');
  const second = await service.enqueue('npp-1', 'u', 'phone-1', { labels: [label()] });
  assert.equal(second.stationOnline, true);
});

test('a station that has not polled recently is offline', async () => {
  const { service, tables } = setup();
  await service.poll('npp-1', 'desktop-1');
  tables.printStations[0].lastSeenAt = new Date(Date.now() - STATION_ONLINE_MS - 1000);
  assert.equal(await service.stationOnline('npp-1'), false);
  tables.printStations[0].lastSeenAt = new Date();
  assert.equal(await service.stationOnline('npp-1'), true);
  assert.equal(await service.stationOnline('npp-2'), false);
});

test('enqueue validates the labels', async () => {
  const { service } = setup();
  await assert.rejects(service.enqueue('npp-1', 'u', 's', { labels: [] }), BadRequestException);
  await assert.rejects(service.enqueue('npp-1', 'u', 's', { labels: [label('nonsense')] }), /mã vạch/i);
  await assert.rejects(service.enqueue('npp-1', 'u', 's', { labels: [label('CL8-0600-0900', { widthMm: 0 })] }), /kích thước/i);
  await assert.rejects(service.enqueue('npp-1', 'u', 's', { labels: Array.from({ length: 501 }, () => label()) }), /tối đa/i);
});

test('poll hands out the oldest queued job once and marks it claimed', async () => {
  const { service, tables } = setup();
  const a = await service.enqueue('npp-1', 'u', 'phone', { labels: [label('CL8-0600-0900')] });
  tables.printJobs[0].createdAt = new Date(Date.now() - 5000);
  await service.enqueue('npp-1', 'u', 'phone', { labels: [label('CL8-0700-0800')] });
  const got = await service.poll('npp-1', 'desktop-1');
  assert.equal(got.job!.id, a.id);
  assert.equal(got.job!.labels.length, 1);
  assert.equal(tables.printJobs.find((j) => j.id === a.id)!.status, 'CLAIMED');
  const next = await service.poll('npp-1', 'desktop-1');
  assert.notEqual(next.job!.id, a.id);
  assert.equal((await service.poll('npp-1', 'desktop-1')).job, null);
});

test('two stations never get the same job and never see another NPP jobs', async () => {
  const { service } = setup();
  await service.enqueue('npp-1', 'u', 'phone', { labels: [label()] });
  await service.enqueue('npp-2', 'u', 'phone', { labels: [label('CL8-0900-1000')] });
  const [a, b] = await Promise.all([service.poll('npp-1', 'd1'), service.poll('npp-1', 'd2')]);
  assert.equal([a.job, b.job].filter(Boolean).length, 1);
  const other = await service.poll('npp-2', 'd9');
  assert.equal(other.job!.labels[0].barcode, 'CL8-0900-1000');
});

test('a job claimed by a station that died is handed out again', async () => {
  const { service, tables } = setup();
  const job = await service.enqueue('npp-1', 'u', 'phone', { labels: [label()] });
  await service.poll('npp-1', 'dead-station');
  assert.equal((await service.poll('npp-1', 'd2')).job, null);
  tables.printJobs.find((j) => j.id === job.id)!.claimedAt = new Date(Date.now() - STALE_CLAIM_MS - 1000);
  const again = await service.poll('npp-1', 'd2');
  assert.equal(again.job!.id, job.id);
});

test('complete marks a claimed job printed or failed and is idempotent', async () => {
  const { service, tables } = setup();
  const ok = await service.enqueue('npp-1', 'u', 'phone', { labels: [label()] });
  await service.poll('npp-1', 'd1');
  const done = await service.complete('npp-1', ok.id, { ok: true });
  assert.equal(done.status, 'PRINTED');
  assert.ok(tables.printJobs[0].printedAt);
  assert.equal((await service.complete('npp-1', ok.id, { ok: false, error: 'late' })).status, 'PRINTED');
  const bad = await service.enqueue('npp-1', 'u', 'phone', { labels: [label()] });
  await service.poll('npp-1', 'd1');
  const failed = await service.complete('npp-1', bad.id, { ok: false, error: 'Hết giấy' });
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.error, 'Hết giấy');
});

test('a queued job cannot be completed before a station picked it up, and other NPPs cannot touch it', async () => {
  const { service } = setup();
  const job = await service.enqueue('npp-1', 'u', 'phone', { labels: [label()] });
  await assert.rejects(service.complete('npp-1', job.id, { ok: true }), /chưa được trạm in nhận/);
  await assert.rejects(service.complete('npp-2', job.id, { ok: true }), NotFoundException);
  await assert.rejects(service.getJob('npp-2', job.id), NotFoundException);
});

test('list returns the recent jobs of the NPP, newest first, without the label bodies', async () => {
  const { service } = setup();
  await service.enqueue('npp-1', 'u', 'p', { labels: [label()] });
  await service.enqueue('npp-1', 'u', 'p', { labels: [label(), label()] });
  await service.enqueue('npp-2', 'u', 'p', { labels: [label()] });
  const list = await service.listJobs('npp-1');
  assert.equal(list.length, 2);
  assert.equal(list[0].labelCount, 2);
  assert.equal((list[0] as unknown as { labels?: unknown }).labels, undefined);
});
