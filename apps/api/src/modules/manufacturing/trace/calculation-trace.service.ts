import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export type TraceStepInput = { stage: string; sourceRule?: string; input?: unknown; output?: unknown; diagnostics?: unknown };

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const optionalJson = (value: unknown): Prisma.InputJsonValue | undefined => value === undefined ? undefined : json(value);

@Injectable()
export class CalculationTraceService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    executionId?: string;
    doorDesignRevisionId: string;
    datasetRevisionId: string;
    engineVersion: string;
    rulePackVersion: string;
    priceBookVersion?: string;
    calculationInput: unknown;
    calculationOutput: unknown;
    warnings?: unknown;
    startedAt: Date;
    steps: TraceStepInput[];
  }) {
    return this.prisma.calculationTrace.create({
      data: {
        executionId: input.executionId ?? randomUUID(),
        doorDesignRevisionId: input.doorDesignRevisionId,
        datasetRevisionId: input.datasetRevisionId,
        engineVersion: input.engineVersion,
        rulePackVersion: input.rulePackVersion,
        priceBookVersion: input.priceBookVersion,
        input: json(input.calculationInput),
        output: json(input.calculationOutput),
        warnings: optionalJson(input.warnings),
        startedAt: input.startedAt,
        completedAt: new Date(),
        steps: { create: input.steps.map((step, index) => ({ sequence: index + 1, stage: step.stage, sourceRule: step.sourceRule, input: optionalJson(step.input), output: optionalJson(step.output), diagnostics: optionalJson(step.diagnostics) })) },
      },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });
  }
}
