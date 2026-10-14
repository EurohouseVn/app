import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
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
  };
  const service = new WorkforceService(prisma as never);
  const result = await service.payroll(authenticatedUser, '2026-09');
  assert.equal(result[0].daysWorked, 1);
  assert.equal(result[0].basePay, 450_000);
  assert.equal(result[0].overtimePay, 127_500);
  assert.equal(result[0].estimatedPay, 577_500);
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
