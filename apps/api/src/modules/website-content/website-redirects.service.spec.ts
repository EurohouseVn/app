import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import { WebsiteRedirectsService, normalizeInternalRedirectPath } from './website-redirects.service';

const actor: JwtUser = { sub: 'admin-1', email: 'admin@eurohouse.vn', role: 'ADMIN' };

type RedirectRow = {
  id: string;
  sourcePath: string;
  destinationPath: string;
  statusCode: number;
  active: boolean;
  createdById: string;
};

function prismaStub(seed: Array<Omit<RedirectRow, 'id' | 'statusCode' | 'active'> & Partial<Pick<RedirectRow, 'statusCode' | 'active'>>> = []) {
  const rows: RedirectRow[] = seed.map((row, index) => ({
    id: `redirect-${index + 1}`,
    statusCode: 301,
    active: true,
    ...row,
  }));
  const audits: Array<Record<string, unknown>> = [];
  const tx: any = {
    websiteRedirect: {
      findUnique: async ({ where }: any) => rows.find((row) => row.id === where.id || row.sourcePath === where.sourcePath) ?? null,
      findFirst: async ({ where }: any) => rows.find((row) => {
        if (where.id?.not && row.id === where.id.not) return false;
        if (where.active !== undefined && row.active !== where.active) return false;
        return where.OR.some((clause: any) =>
          (clause.sourcePath !== undefined && row.sourcePath === clause.sourcePath)
          || (clause.destinationPath !== undefined && row.destinationPath === clause.destinationPath));
      }) ?? null,
      findMany: async () => rows,
      create: async ({ data }: any) => {
        const row = { id: `redirect-${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) throw new Error('missing redirect');
        Object.assign(row, data);
        return row;
      },
    },
    websitePublicationAudit: {
      create: async ({ data }: any) => {
        audits.push(data);
        return data;
      },
    },
  };
  return {
    rows,
    audits,
    prisma: { ...tx, $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) },
  };
}

test('redirect paths normalize leading and trailing slashes and reject query strings', () => {
  assert.equal(normalizeInternalRedirectPath('san-pham//eu55/'), '/san-pham/eu55');
  assert.equal(normalizeInternalRedirectPath('/'), '/');
  assert.throws(() => normalizeInternalRedirectPath('/eu55?utm_source=old'), BadRequestException);
  assert.throws(() => normalizeInternalRedirectPath('https://example.com/eu55'), BadRequestException);
  assert.throws(() => normalizeInternalRedirectPath('//example.com/eu55'), BadRequestException);
});

test('inactive redirects do not resolve and public resolution returns no database fields', async () => {
  const { prisma } = prismaStub([
    { sourcePath: '/old', destinationPath: '/new', active: false, createdById: 'admin-1' },
    { sourcePath: '/legacy', destinationPath: '/current', active: true, statusCode: 308, createdById: 'admin-1' },
  ]);
  const service = new WebsiteRedirectsService(prisma as never);

  assert.equal(await service.resolve('/old/'), null);
  assert.deepEqual(await service.resolve('legacy'), { destinationPath: '/current', statusCode: 308 });
});

test('self redirects, loops and chains longer than one hop are rejected', async () => {
  const { prisma } = prismaStub([
    { sourcePath: '/a', destinationPath: '/b', active: true, createdById: 'admin-1' },
  ]);
  const service = new WebsiteRedirectsService(prisma as never);

  await assert.rejects(() => service.create({ sourcePath: '/same/', destinationPath: 'same' }, actor), BadRequestException);
  await assert.rejects(() => service.create({ sourcePath: '/b', destinationPath: '/c' }, actor), BadRequestException);
  await assert.rejects(() => service.create({ sourcePath: '/z', destinationPath: '/a' }, actor), BadRequestException);
  await assert.rejects(() => service.create({ sourcePath: '/b', destinationPath: '/a' }, actor), BadRequestException);
});

test('valid internal redirect is normalized, stored and audited', async () => {
  const { prisma, rows, audits } = prismaStub();
  const service = new WebsiteRedirectsService(prisma as never);

  const result = await service.create({ sourcePath: 'cu/eu55/', destinationPath: '/nhom-dan-dung/eu55', statusCode: 301 }, actor);

  assert.equal(result.sourcePath, '/cu/eu55');
  assert.equal(rows.length, 1);
  assert.equal(audits[0]?.action, 'REDIRECT_CREATED');
});
