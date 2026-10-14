import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { InventoryOwnerType } from './inventory-mutation-policy';

export type InventoryCommandContext = {
  idempotencyKey: string;
  actorId: string;
  organizationId?: string;
  ownerType: InventoryOwnerType;
  ownerId: string;
  command: string;
};

@Injectable()
export class InventoryCommandService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    context: InventoryCommandContext,
    payload: unknown,
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const key = context.idempotencyKey?.trim();
    if (!key || key.length < 8 || key.length > 160) throw new BadRequestException('Idempotency-Key must contain 8 to 160 characters.');
    const requestHash = createHash('sha256').update(this.stableJson(payload)).digest('hex');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const unique = { ownerType_ownerId_command_idempotencyKey: { ownerType: context.ownerType, ownerId: context.ownerId, command: context.command, idempotencyKey: key } };
        const existing = await tx.inventoryCommand.findUnique({ where: unique });
        if (existing) {
          if (existing.requestHash !== requestHash) throw new ConflictException('Idempotency-Key was already used with a different request.');
          if (existing.status === 'COMPLETED') return existing.result as T;
          throw new ConflictException('The inventory command is already in progress.');
        }
        const command = await tx.inventoryCommand.create({
          data: {
            idempotencyKey: key,
            actorId: context.actorId,
            organizationId: context.organizationId,
            ownerType: context.ownerType,
            ownerId: context.ownerId,
            command: context.command,
            requestHash,
          },
        });
        const result = await handler(tx);
        await tx.inventoryCommand.update({
          where: { id: command.id },
          data: { status: 'COMPLETED', result: result as any, completedAt: new Date() },
        });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.inventoryCommand.findUnique({
          where: { ownerType_ownerId_command_idempotencyKey: { ownerType: context.ownerType, ownerId: context.ownerId, command: context.command, idempotencyKey: key } },
        });
        if (existing?.requestHash === requestHash && existing.status === 'COMPLETED') return existing.result as T;
        throw new ConflictException('The inventory command is already in progress.');
      }
      throw error;
    }
  }

  private stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableJson(item)).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${this.stableJson(item)}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
  }
}
