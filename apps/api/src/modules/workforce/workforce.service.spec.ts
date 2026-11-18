import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import { WorkforceService } from './workforce.service';

const authenticatedUser: JwtUser = {
  sub: 'factory-user',
  email: 'factory@example.test',
  displayName: 'Factory user',
  role: 'FACTORY',
  organizationId: 'factory-org',
};

const worker = {
  id: 'worker-1',
  organizationId: 'factory-org',
  name: 'Nguyễn Văn An',
  phone: '',
  roleName: 'Thợ sản xuất',
  payType: 'DAILY',
  baseRate: 450_000,
  overtimeRate: 85_000,
  standardMonthlyDays: 26,
  sundayPayEnabled: true,
  sundayPayPercent: 200,
  holidayPayEnabled: true,
  holidayPayPercent: 300,
  insuranceEnabled: false,
  insuranceSalary: 0,
  paidLeaveDaysPerMonth: 1,
  active: true,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
};

/** Prisma giả: mặc định không có tháng chốt, việc khoán hay khoản cộng/trừ. */
function payrollPrisma(overrides: Record<string, unknown> = {}) {
  return {
    workshopWorker: { findMany: async () => [worker], findFirst: async () => worker },
    workshopAttendance: { findMany: async () => [] },
    workshopWorkdaySetting: { findMany: async () => [] },
    workshopPayrollClose: { findUnique: async () => null },
    workshopPieceJobShare: { findMany: async () => [] },
    workshopPayAdjustment: { findMany: async () => [] },
    organization: { findUnique: async () => ({ name: 'Xưởng Nhôm Kính An Phát' }) },
    ...overrides,
  };
}

test('worker list is always scoped to the authenticated CSSX organization', async () => {
  let capturedWhere: Record<string, unknown> | undefined;
  const prisma = {
    workshopWorker: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        capturedWhere = args.where;
        return [];
      },
    },
  };
  const service = new WorkforceService(prisma as never);
  await service.workers(authenticatedUser);
  assert.equal(capturedWhere?.organizationId, 'factory-org');
  assert.equal(capturedWhere?.active, true);
});

test('daily payroll adds the configured overtime rate', async () => {
  const prisma = payrollPrisma({
    workshopAttendance: {
      findMany: async () => [{
        id: 'attendance-1',
        organizationId: 'factory-org',
        workerId: 'worker-1',
        workDate: new Date('2026-09-29T00:00:00.000Z'),
        checkInAt: new Date('2026-09-29T01:00:00.000Z'),
        checkOutAt: new Date('2026-09-29T10:30:00.000Z'),
        regularHours: 8,
        overtimeHours: 1.5,
        status: 'PRESENT',
        note: '',
        createdAt: new Date('2026-09-29T01:00:00.000Z'),
        updatedAt: new Date('2026-09-29T10:30:00.000Z'),
      }],
    },
  });
  const service = new WorkforceService(prisma as never);
  const result = await service.payroll(authenticatedUser, '2026-09');
  const slip = result.rows[0].payslip;
  assert.equal(result.closed, false);
  assert.equal(result.rows[0].daysWorked, 1);
  assert.equal(slip.basePay, 450_000);
  assert.equal(slip.sundayPay, 0);
  assert.equal(slip.holidayPay, 0);
  assert.equal(slip.overtimePay, 127_500);
  assert.equal(result.rows[0].estimatedPay, 577_500);
  assert.equal(result.totals.net, 577_500);
});

test('payroll applies holiday pay before Sunday pay when a marked holiday falls on Sunday', async () => {
  const holiday = new Date('2026-10-04T00:00:00.000Z');
  const prisma = payrollPrisma({
    workshopAttendance: {
      findMany: async () => [{
        id: 'attendance-holiday',
        organizationId: 'factory-org',
        workerId: worker.id,
        workDate: holiday,
        checkInAt: new Date('2026-10-04T01:00:00.000Z'),
        checkOutAt: new Date('2026-10-04T09:00:00.000Z'),
        regularHours: 8,
        overtimeHours: 0,
        status: 'PRESENT',
        note: '',
        createdAt: holiday,
        updatedAt: holiday,
      }],
    },
    workshopWorkdaySetting: {
      findMany: async () => [{ workDate: holiday, isHoliday: true }],
    },
  });
  const service = new WorkforceService(prisma as never);
  const result = await service.payroll(authenticatedUser, '2026-10');
  const slip = result.rows[0].payslip;
  assert.equal(slip.holidayDays, 1);
  assert.equal(slip.sundayDays, 0);
  assert.equal(slip.basePay, 450_000);
  assert.equal(slip.holidayPay, 900_000);
  assert.equal(result.rows[0].estimatedPay, 1_350_000);
});

test('a CSSX cannot update a worker belonging to another organization', async () => {
  const prisma = {
    workshopWorker: { findFirst: async () => null },
  };
  const service = new WorkforceService(prisma as never);
  await assert.rejects(
    service.updateWorker(authenticatedUser, 'worker-other', { baseRate: 999_999 }),
    NotFoundException,
  );
});

test('worker edit persists Sunday and holiday pay settings', async () => {
  let updateArgs: { data: Record<string, unknown> } | undefined;
  const prisma = {
    workshopWorker: {
      findFirst: async () => worker,
      update: async (args: { data: Record<string, unknown> }) => {
        updateArgs = args;
        return { ...worker, ...args.data };
      },
    },
  };
  const service = new WorkforceService(prisma as never);
  await service.updateWorker(authenticatedUser, worker.id, {
    baseRate: 500_000,
    sundayPayEnabled: true,
    sundayPayPercent: 225,
    holidayPayEnabled: true,
    holidayPayPercent: 350,
  });
  assert.equal(updateArgs?.data.baseRate, 500_000);
  assert.equal(updateArgs?.data.sundayPayEnabled, true);
  assert.equal(updateArgs?.data.sundayPayPercent, 225);
  assert.equal(updateArgs?.data.holidayPayEnabled, true);
  assert.equal(updateArgs?.data.holidayPayPercent, 350);
});

test('deleting a worker preserves history by deactivating the scoped record', async () => {
  let updateArgs: unknown;
  const prisma = {
    workshopWorker: {
      findFirst: async () => worker,
      update: async (args: unknown) => {
        updateArgs = args;
        return { ...worker, active: false };
      },
    },
  };
  const service = new WorkforceService(prisma as never);
  assert.deepEqual(await service.deleteWorker(authenticatedUser, worker.id), { deleted: true });
  assert.deepEqual(updateArgs, { where: { id: worker.id }, data: { active: false } });
});

test('a past day of an open month can still be corrected', async () => {
  let upsertArgs: { create: Record<string, unknown>; update: Record<string, unknown> } | undefined;
  const prisma = payrollPrisma({
    workshopAttendance: {
      upsert: async (args: typeof upsertArgs) => {
        upsertArgs = args;
        return { id: 'a1', ...args!.create, worker, workDate: new Date('2026-11-03T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() };
      },
    },
  });
  const service = new WorkforceService(prisma as never, () => new Date('2026-11-18T03:00:00.000Z'));
  await service.setDayStatus(authenticatedUser, { workerId: worker.id, date: '2026-11-03', status: 'HALF' });
  assert.equal(upsertArgs?.create.status, 'HALF');
  assert.equal(upsertArgs?.update.status, 'HALF');
  assert.equal(upsertArgs?.create.organizationId, 'factory-org');
});

test('marking a day as leave clears worked hours', async () => {
  let upsertArgs: { update: Record<string, unknown> } | undefined;
  const prisma = payrollPrisma({
    workshopAttendance: {
      upsert: async (args: typeof upsertArgs) => {
        upsertArgs = args;
        return { id: 'a1', status: 'LEAVE', worker, workDate: new Date(), createdAt: new Date(), updatedAt: new Date() };
      },
    },
  });
  const service = new WorkforceService(prisma as never, () => new Date('2026-11-18T03:00:00.000Z'));
  await service.setDayStatus(authenticatedUser, { workerId: worker.id, date: '2026-11-18', status: 'LEAVE' });
  assert.equal(upsertArgs?.update.regularHours, 0);
  assert.equal(upsertArgs?.update.overtimeHours, 0);
});

test('a closed payroll month locks attendance', async () => {
  const prisma = payrollPrisma({
    workshopPayrollClose: { findUnique: async () => ({ month: '2026-10', closedAt: new Date() }) },
    workshopAttendance: { upsert: async () => assert.fail('must not write') },
  });
  const service = new WorkforceService(prisma as never, () => new Date('2026-11-18T03:00:00.000Z'));
  await assert.rejects(
    service.setDayStatus(authenticatedUser, { workerId: worker.id, date: '2026-10-30', status: 'PRESENT' }),
    /Tháng 10\/2026 đã chốt lương/,
  );
});

test('a future day cannot be marked', async () => {
  const service = new WorkforceService(payrollPrisma() as never, () => new Date('2026-11-18T03:00:00.000Z'));
  await assert.rejects(
    service.setDayStatus(authenticatedUser, { workerId: worker.id, date: '2026-11-19', status: 'PRESENT' }),
    BadRequestException,
  );
});

test('mark all present only fills workers without a record for the day', async () => {
  let created: Array<Record<string, unknown>> = [];
  const second = { ...worker, id: 'worker-2', name: 'Trần Minh Tâm' };
  const prisma = payrollPrisma({
    workshopWorker: { findMany: async () => [worker, second] },
    workshopAttendance: {
      findMany: async () => [{ workerId: worker.id }],
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        created = args.data;
        return { count: args.data.length };
      },
    },
  });
  const service = new WorkforceService(prisma as never, () => new Date('2026-11-18T03:00:00.000Z'));
  assert.deepEqual(await service.markAllPresent(authenticatedUser, '2026-11-18'), { created: 1 });
  assert.equal(created[0].workerId, 'worker-2');
  assert.equal(created[0].status, 'PRESENT');
});

test('a piece job is split equally, the remainder going to the first worker', async () => {
  let createArgs: { data: Record<string, any> } | undefined;
  const others = [{ ...worker, id: 'w2', name: 'B' }, { ...worker, id: 'w3', name: 'C' }];
  const prisma = payrollPrisma({
    workshopWorker: { findMany: async () => [worker, ...others] },
    workshopPieceJob: {
      create: async (args: typeof createArgs) => {
        createArgs = args;
        return { id: 'job-1', ...args!.data, shares: [], workDate: new Date('2026-11-10T00:00:00.000Z'), createdAt: new Date() };
      },
    },
  });
  const service = new WorkforceService(prisma as never, () => new Date('2026-11-18T03:00:00.000Z'));
  await service.createPieceJob(authenticatedUser, {
    title: 'Lắp cửa nhà chị Lan', workDate: '2026-11-10', totalAmount: 1_000_000, workerIds: [worker.id, 'w2', 'w3'],
  });
  const shares = createArgs?.data.shares.create as Array<{ workerId: string; amount: number }>;
  assert.deepEqual(shares.map((share) => share.amount), [333_334, 333_333, 333_333]);
  assert.equal(createArgs?.data.organizationId, 'factory-org');
});

test('a piece job rejects workers from another workshop', async () => {
  const prisma = payrollPrisma({ workshopWorker: { findMany: async () => [worker] } });
  const service = new WorkforceService(prisma as never, () => new Date('2026-11-18T03:00:00.000Z'));
  await assert.rejects(
    service.createPieceJob(authenticatedUser, { title: 'X', workDate: '2026-11-10', totalAmount: 100, workerIds: [worker.id, 'foreign'] }),
    BadRequestException,
  );
});

test('manual piece shares must add up to the job total', async () => {
  const prisma = payrollPrisma({ workshopWorker: { findMany: async () => [worker, { ...worker, id: 'w2' }] } });
  const service = new WorkforceService(prisma as never, () => new Date('2026-11-18T03:00:00.000Z'));
  await assert.rejects(
    service.createPieceJob(authenticatedUser, {
      title: 'X', workDate: '2026-11-10', totalAmount: 1_000_000,
      shares: [{ workerId: worker.id, amount: 600_000 }, { workerId: 'w2', amount: 300_000 }],
    }),
    /tổng/i,
  );
});

test('the payslip adds piece shares, bonuses and deducts advances', async () => {
  const day = (date: string, status: string) => ({
    id: date, organizationId: 'factory-org', workerId: worker.id, workDate: new Date(`${date}T00:00:00.000Z`),
    checkInAt: null, checkOutAt: null, regularHours: 0, overtimeHours: 0, status, note: '', createdAt: new Date(), updatedAt: new Date(),
  });
  const prisma = payrollPrisma({
    workshopAttendance: { findMany: async () => [day('2026-11-02', 'PRESENT'), day('2026-11-03', 'HALF')] },
    workshopPieceJobShare: {
      findMany: async () => [{ workerId: worker.id, amount: 250_000, job: { title: 'Gia công vách kính', projectName: 'CT-261020', workDate: new Date('2026-11-05T00:00:00.000Z') } }],
    },
    workshopPayAdjustment: {
      findMany: async () => [
        { workerId: worker.id, kind: 'BONUS', amount: 100_000, note: 'Làm tốt', workDate: new Date('2026-11-06T00:00:00.000Z') },
        { workerId: worker.id, kind: 'ADVANCE', amount: 300_000, note: '', workDate: new Date('2026-11-07T00:00:00.000Z') },
      ],
    },
  });
  const service = new WorkforceService(prisma as never, () => new Date('2026-11-18T03:00:00.000Z'));
  const view = await service.payslip(authenticatedUser, worker.id, '2026-11');
  assert.equal(view.organizationName, 'Xưởng Nhôm Kính An Phát');
  assert.equal(view.payslip.workUnits, 1.5);
  assert.equal(view.payslip.basePay, 675_000);
  assert.equal(view.payslip.pieceTotal, 250_000);
  assert.equal(view.payslip.pieces[0].projectName, 'CT-261020');
  assert.equal(view.payslip.gross, 1_025_000);
  assert.equal(view.payslip.net, 725_000);
  assert.equal(view.basePayFormula, '450.000 × 1,5 công');
});

test('closing a month records its net total and refuses a second close', async () => {
  let created: Record<string, unknown> | undefined;
  const prisma = payrollPrisma({
    workshopAttendance: {
      findMany: async () => [{
        id: 'x', organizationId: 'factory-org', workerId: worker.id, workDate: new Date('2026-10-02T00:00:00.000Z'),
        checkInAt: null, checkOutAt: null, regularHours: 0, overtimeHours: 0, status: 'PRESENT', note: '', createdAt: new Date(), updatedAt: new Date(),
      }],
    },
    workshopPayrollClose: {
      findUnique: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        created = args.data;
        return { ...args.data, closedAt: new Date('2026-11-01T02:00:00.000Z') };
      },
    },
  });
  const service = new WorkforceService(prisma as never, () => new Date('2026-11-18T03:00:00.000Z'));
  const month = await service.closeMonth(authenticatedUser, '2026-10');
  assert.equal(created?.totalNet, 450_000);
  assert.equal(created?.month, '2026-10');
  assert.equal(month.closed, true);

  const closedPrisma = payrollPrisma({ workshopPayrollClose: { findUnique: async () => ({ month: '2026-10', closedAt: new Date() }) } });
  const closedService = new WorkforceService(closedPrisma as never, () => new Date('2026-11-18T03:00:00.000Z'));
  await assert.rejects(closedService.closeMonth(authenticatedUser, '2026-10'), /đã chốt/);
});

test('the current month cannot be closed before it ends', async () => {
  const service = new WorkforceService(payrollPrisma() as never, () => new Date('2026-11-18T03:00:00.000Z'));
  await assert.rejects(service.closeMonth(authenticatedUser, '2026-11'), /chưa kết thúc/);
});

test('attendance rejects a malformed worker id before querying the database', async () => {
  let queried = false;
  const prisma = {
    workshopWorker: {
      findFirst: async () => {
        queried = true;
        return worker;
      },
    },
  };
  const service = new WorkforceService(prisma as never);
  await assert.rejects(
    service.checkAttendance(authenticatedUser, { workerId: ['worker-a'] as unknown as string, action: 'CHECK_IN' }),
    BadRequestException,
  );
  assert.equal(queried, false);
});
