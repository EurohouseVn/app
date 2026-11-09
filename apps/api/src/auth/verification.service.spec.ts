import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { VerificationService } from './verification.service';

type Challenge = {
  id: string;
  userId: string;
  channel: 'EMAIL' | 'PHONE';
  targetNormalized: string;
  codeHash: string;
  expiresAt: Date;
  attemptCount: number;
  consumedAt: Date | null;
  createdAt: Date;
  lastSentAt: Date;
};

function fixture(now = new Date('2026-11-08T10:00:00.000Z')) {
  const challenges: Challenge[] = [];
  const sent: unknown[] = [];
  const store = {
    verificationChallenge: {
      updateMany: async ({ where, data }: any) => {
        for (const challenge of challenges) {
          if (challenge.userId === where.userId && challenge.consumedAt === null) Object.assign(challenge, data);
        }
      },
      create: async ({ data }: any) => {
        const challenge = { id: `c${challenges.length + 1}`, attemptCount: 0, consumedAt: null, createdAt: now, ...data } as Challenge;
        challenges.push(challenge);
        return challenge;
      },
      findFirst: async ({ where }: any) => [...challenges].reverse().find((item) => item.userId === where.userId) ?? null,
      update: async ({ where, data }: any) => {
        const challenge = challenges.find((item) => item.id === where.id)!;
        Object.assign(challenge, data.attemptCount?.increment ? { attemptCount: challenge.attemptCount + data.attemptCount.increment } : data);
        return challenge;
      },
    },
    $transaction: async (work: (tx: any) => unknown) => {
      const snapshot = challenges.map((challenge) => ({ ...challenge }));
      try { return await work(store); }
      catch (error) { challenges.splice(0, challenges.length, ...snapshot); throw error; }
    },
  };
  const delivery = { send: async (input: unknown) => void sent.push(input) };
  const service = new VerificationService(store as never, delivery, {
    now: () => now,
    randomCode: () => '123456',
  });
  return { challenges, sent, service, now };
}

test('create persists only a hash with ten-minute expiry and delivers the clear code externally', async () => {
  const { challenges, sent, service, now } = fixture();
  const result = await service.create('u1', 'EMAIL', 'user@example.com');

  assert.equal(result.challengeId, 'c1');
  assert.equal(challenges[0].codeHash, createHash('sha256').update('123456').digest('hex'));
  assert.equal(JSON.stringify(challenges).includes('123456'), false);
  assert.equal(challenges[0].expiresAt.toISOString(), new Date(now.getTime() + 10 * 60_000).toISOString());
  assert.deepEqual(sent[0], { channel: 'EMAIL', target: 'user@example.com', code: '123456', expiresMinutes: 10 });
});

test('confirm rejects consumed, expired, and more than five invalid attempts', async () => {
  const { challenges, service, now } = fixture();
  await service.create('u1', 'PHONE', '+84912345678');
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await assert.rejects(() => service.confirm('u1', '000000'), /VERIFICATION_CODE_INVALID/);
  }
  assert.equal(challenges[0].attemptCount, 5);
  await assert.rejects(() => service.confirm('u1', '123456'), /VERIFICATION_ATTEMPTS_EXCEEDED/);

  challenges[0].attemptCount = 0;
  challenges[0].consumedAt = now;
  await assert.rejects(() => service.confirm('u1', '123456'), /VERIFICATION_CODE_CONSUMED/);
  challenges[0].consumedAt = null;
  challenges[0].expiresAt = new Date(now.getTime() - 1);
  await assert.rejects(() => service.confirm('u1', '123456'), /VERIFICATION_CODE_EXPIRED/);
});

test('resend enforces a sixty-second cooldown and invalidates the prior challenge', async () => {
  const { challenges, service, now } = fixture();
  await service.create('u1', 'EMAIL', 'user@example.com');
  await assert.rejects(() => service.resend('u1'), /VERIFICATION_RESEND_COOLDOWN/);
  challenges[0].lastSentAt = new Date(now.getTime() - 60_001);
  await service.resend('u1');
  assert.equal(challenges[0].consumedAt?.toISOString(), now.toISOString());
  assert.equal(challenges.length, 2);
});
