import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  VERIFICATION_DELIVERY,
  type VerificationChannelValue,
  type VerificationDeliveryPort,
} from './verification-delivery.service';

export const VERIFICATION_OPTIONS = Symbol('VERIFICATION_OPTIONS');
type VerificationOptions = {
  now?: () => Date;
  randomCode?: () => string;
};

const EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

@Injectable()
export class VerificationService {
  private readonly now: () => Date;
  private readonly randomCode: () => string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VERIFICATION_DELIVERY) private readonly delivery: VerificationDeliveryPort,
    @Optional() @Inject(VERIFICATION_OPTIONS) options?: VerificationOptions,
  ) {
    this.now = options?.now ?? (() => new Date());
    this.randomCode = options?.randomCode ?? (() => randomInt(0, 1_000_000).toString().padStart(6, '0'));
  }

  async create(userId: string, channel: VerificationChannelValue, target: string) {
    const now = this.now();
    const code = this.randomCode();
    const expiresAt = new Date(now.getTime() + EXPIRY_MINUTES * 60_000);
    const challenge = await this.prisma.$transaction(async (tx) => {
      await tx.verificationChallenge.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: now },
      });
      return tx.verificationChallenge.create({
        data: {
          userId,
          channel,
          targetNormalized: target,
          codeHash: hashCode(code),
          expiresAt,
          lastSentAt: now,
        },
      });
    });
    await this.delivery.send({ channel, target, code, expiresMinutes: EXPIRY_MINUTES });
    return { challengeId: challenge.id, expiresAt };
  }

  async resend(userId: string) {
    const current = await this.prisma.verificationChallenge.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!current) throw new Error('VERIFICATION_CHALLENGE_NOT_FOUND');
    if (this.now().getTime() - current.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new Error('VERIFICATION_RESEND_COOLDOWN');
    }
    return this.create(userId, current.channel, current.targetNormalized);
  }

  async confirm(userId: string, code: string) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const challenge = await tx.verificationChallenge.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (!challenge) throw new Error('VERIFICATION_CHALLENGE_NOT_FOUND');
      if (challenge.consumedAt) throw new Error('VERIFICATION_CODE_CONSUMED');
      if (challenge.expiresAt.getTime() <= this.now().getTime()) throw new Error('VERIFICATION_CODE_EXPIRED');
      if (challenge.attemptCount >= MAX_ATTEMPTS) throw new Error('VERIFICATION_ATTEMPTS_EXCEEDED');

      const expected = Buffer.from(challenge.codeHash, 'hex');
      const received = Buffer.from(hashCode(code), 'hex');
      if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        await tx.verificationChallenge.update({
          where: { id: challenge.id },
          data: { attemptCount: { increment: 1 } },
        });
        return { ok: false as const };
      }

      const consumedAt = this.now();
      await tx.verificationChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt },
      });
      return { ok: true as const, value: { userId, channel: challenge.channel, targetNormalized: challenge.targetNormalized, consumedAt } };
    });
    if (!outcome.ok) throw new Error('VERIFICATION_CODE_INVALID');
    return outcome.value;
  }
}
