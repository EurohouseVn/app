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
  active: true,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
};

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
  const prisma = {
    workshopWorker: { findMany: async () => [worker] },
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
    workshopWorkdaySetting: { findMany: async () => [] },
  };
  const service = new WorkforceService(prisma as never);
  const result = await service.payroll(authenticatedUser, '2026-09');
  assert.equal(result[0].daysWorked, 1);
  assert.equal(result[0].basePay, 450_000);
  assert.equal(result[0].sundayPay, 0);
  assert.equal(result[0].holidayPay, 0);
  assert.equal(result[0].overtimePay, 127_500);
  assert.equal(result[0].estimatedPay, 577_500);
});

test('payroll applies holiday pay before Sunday pay when a marked holiday falls on Sunday', async () => {
  const holiday = new Date('2026-10-04T00:00:00.000Z');
  const prisma = {
    workshopWorker: { findMany: async () => [worker] },
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
  };
  const service = new WorkforceService(prisma as never);
  const result = await service.payroll(authenticatedUser, '2026-10');
  assert.equal(result[0].holidayDays, 1);
  assert.equal(result[0].sundayDays, 0);
  assert.equal(result[0].basePay, 450_000);
  assert.equal(result[0].holidayPay, 900_000);
  assert.equal(result[0].estimatedPay, 1_350_000);
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

test('attendance from a previous day is immutable', async () => {
  const prisma = {
    workshopAttendance: {
      findFirst: async () => ({ id: 'attendance-old', organizationId: 'factory-org', workDate: new Date('2000-01-01T00:00:00.000Z') }),
    },
  };
  const service = new WorkforceService(prisma as never);
  await assert.rejects(
    service.updateAttendance(authenticatedUser, 'attendance-old', { overtimeHours: 2 }),
    BadRequestException,
  );
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
