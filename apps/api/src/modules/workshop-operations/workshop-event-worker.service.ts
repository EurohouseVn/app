import { ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { eventRetryDelayMs, eventShouldDeadLetter, organizationScope } from './workshop-operations.rules';

const NOTIFIABLE_EVENTS = new Set([
  'WORK_ORDER_READY',
  'WORK_ORDER_COMPLETED',
  'INSTALLATION_SCHEDULED',
  'INSTALLATION_COMPLETED',
  'WARRANTY_REQUESTED',
]);

@Injectable()
export class WorkshopEventWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkshopEventWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.WORKSHOP_EVENT_WORKER_ENABLED === 'false') return;
    const intervalMs = Math.max(5_000, Number(process.env.WORKSHOP_EVENT_WORKER_INTERVAL_MS) || 15_000);
    this.timer = setInterval(() => void this.processBatch().catch((error) => this.logger.error(error)), intervalMs);
    this.timer.unref();
    void this.processBatch().catch((error) => this.logger.error(error));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processBatch(organizationId?: string, limit = 50) {
    if (this.running) return { claimed: 0, processed: 0, skipped: true };
    this.running = true;
    const token = randomUUID();
    try {
      const now = new Date();
      const staleAt = new Date(now.getTime() - 5 * 60_000);
      await this.prisma.workshopDomainEventOutbox.updateMany({
        where: { status: 'PROCESSING', lockedAt: { lt: staleAt } },
        data: { status: 'FAILED', lockToken: null, lockedAt: null, lastError: 'Worker lock expired', nextAttemptAt: now },
      });
      const candidates = await this.prisma.workshopDomainEventOutbox.findMany({
        where: {
          ...(organizationId ? { organizationId } : {}),
          status: { in: ['PENDING', 'FAILED'] },
          nextAttemptAt: { lte: now },
        },
        orderBy: { createdAt: 'asc' },
        take: Math.min(Math.max(limit, 1), 100),
        select: { id: true },
      });
      const ids = candidates.map((item) => item.id);
      if (!ids.length) return { claimed: 0, processed: 0, skipped: false };
      await this.prisma.workshopDomainEventOutbox.updateMany({
        where: { id: { in: ids }, status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: now } },
        data: { status: 'PROCESSING', lockToken: token, lockedAt: now },
      });
      const events = await this.prisma.workshopDomainEventOutbox.findMany({ where: { lockToken: token }, orderBy: { createdAt: 'asc' } });
      let processed = 0;
      for (const event of events) {
        if (await this.processEvent(event.id, token)) processed += 1;
      }
      return { claimed: events.length, processed, skipped: false };
    } finally {
      this.running = false;
    }
  }

  private async processEvent(id: string, lockToken: string) {
    const event = await this.prisma.workshopDomainEventOutbox.findFirst({ where: { id, lockToken, status: 'PROCESSING' } });
    if (!event) return false;
    try {
      await this.prisma.$transaction(async (tx) => {
        const consumed = await tx.workshopEventConsumption.findUnique({
          where: { outboxId_consumerKey: { outboxId: event.id, consumerKey: 'IN_APP_NOTIFICATION_V1' } },
        });
        if (!consumed && NOTIFIABLE_EVENTS.has(event.eventType)) {
          const users = await tx.user.findMany({ where: { organizationId: event.organizationId }, select: { id: true } });
          if (users.length) {
            await tx.notification.createMany({
              data: users.map((recipient) => ({
                userId: recipient.id,
                title: this.title(event.eventType),
                body: `Có cập nhật mới cho ${event.aggregateType}.`,
                type: event.eventType,
                refId: event.aggregateId,
              })),
            });
          }
          await tx.workshopEventConsumption.create({
            data: { organizationId: event.organizationId, outboxId: event.id, consumerKey: 'IN_APP_NOTIFICATION_V1', sideEffectRef: `${users.length}-notifications` },
          });
        } else if (!consumed) {
          await tx.workshopEventConsumption.create({
            data: { organizationId: event.organizationId, outboxId: event.id, consumerKey: 'IN_APP_NOTIFICATION_V1', sideEffectRef: 'not-applicable' },
          });
        }
        const completedAt = new Date();
        await tx.workshopDomainEventOutbox.update({
          where: { id: event.id },
          data: {
            status: 'PUBLISHED', attempts: { increment: 1 }, publishedAt: completedAt, processedAt: completedAt,
            processingLatencyMs: Math.max(0, completedAt.getTime() - event.createdAt.getTime()),
            lastError: '', lockToken: null, lockedAt: null,
          },
        });
      });
      return true;
    } catch (error) {
      const attempts = event.attempts + 1;
      const dead = eventShouldDeadLetter(attempts);
      await this.prisma.workshopDomainEventOutbox.update({
        where: { id: event.id },
        data: {
          status: dead ? 'DEAD_LETTER' : 'FAILED', attempts,
          nextAttemptAt: new Date(Date.now() + eventRetryDelayMs(attempts)),
          lastError: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown consumer error',
          lockToken: null, lockedAt: null,
        },
      });
      return false;
    }
  }

  async health(user: JwtUser, requestedOrganizationId?: string) {
    this.assertOperator(user);
    const organizationId = organizationScope(user, requestedOrganizationId);
    const now = new Date();
    const [pending, failed, deadLetter, oldest, latency] = await Promise.all([
      this.prisma.workshopDomainEventOutbox.count({ where: { organizationId, status: { in: ['PENDING', 'PROCESSING'] } } }),
      this.prisma.workshopDomainEventOutbox.count({ where: { organizationId, status: 'FAILED' } }),
      this.prisma.workshopDomainEventOutbox.count({ where: { organizationId, status: 'DEAD_LETTER' } }),
      this.prisma.workshopDomainEventOutbox.findFirst({ where: { organizationId, status: { in: ['PENDING', 'FAILED', 'PROCESSING'] } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      this.prisma.workshopDomainEventOutbox.aggregate({ where: { organizationId, processingLatencyMs: { not: null } }, _avg: { processingLatencyMs: true } }),
    ]);
    return {
      organizationId, workerEnabled: process.env.WORKSHOP_EVENT_WORKER_ENABLED !== 'false', pending, failed, deadLetter,
      oldestPendingAgeMs: oldest ? now.getTime() - oldest.createdAt.getTime() : 0,
      averageProcessingLatencyMs: Math.round(latency._avg.processingLatencyMs ?? 0),
    };
  }

  async list(user: JwtUser, requestedOrganizationId?: string, status?: string) {
    this.assertOperator(user);
    const organizationId = organizationScope(user, requestedOrganizationId);
    return this.prisma.workshopDomainEventOutbox.findMany({
      where: { organizationId, ...(status ? { status: status as never } : {}) }, orderBy: { createdAt: 'desc' }, take: 100,
    });
  }

  async retry(user: JwtUser, id: string, requestedOrganizationId?: string) {
    this.assertOperator(user);
    const organizationId = organizationScope(user, requestedOrganizationId);
    const event = await this.prisma.workshopDomainEventOutbox.findFirst({ where: { id, organizationId } });
    if (!event) return { retried: false };
    await this.prisma.workshopDomainEventOutbox.update({
      where: { id }, data: { status: 'PENDING', nextAttemptAt: new Date(), lastError: '', lockedAt: null, lockToken: null },
    });
    return { retried: true };
  }

  private assertOperator(user: JwtUser) {
    if (!user.isCeo && user.role !== 'ADMIN' && user.role !== 'STAFF') throw new ForbiddenException('Chỉ quản trị viên được quản lý event worker.');
  }

  private title(eventType: string) {
    const titles: Record<string, string> = {
      WORK_ORDER_READY: 'Lệnh việc đã sẵn sàng', WORK_ORDER_COMPLETED: 'Lệnh việc đã hoàn tất',
      INSTALLATION_SCHEDULED: 'Đã xếp lịch lắp đặt', INSTALLATION_COMPLETED: 'Lắp đặt đã hoàn tất',
      WARRANTY_REQUESTED: 'Có yêu cầu bảo hành mới',
    };
    return titles[eventType] ?? 'Cập nhật vận hành';
  }
}
