import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { CutPieceRequest, CutRequest, CutResult } from '@eurohouse/types';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryCommandService } from '../inventory/inventory-command.service';
import { CuttingOptimizerService } from './cutting-optimizer.service';
import { FormulaEvaluatorService } from './formula-evaluator.service';

export type ManagedCuttingPlanSetInput = {
  setId?: string;
  setName?: string;
  templateId?: string;
  inputs?: Record<string, unknown>;
};

export type ManagedCuttingPlanInput = {
  planRef?: string;
  sets?: ManagedCuttingPlanSetInput[];
};

export type ManagedCuttingPlanResult = {
  planRef: string;
  generatedAt: string;
  sets: Array<{
    setId: string;
    setName: string;
    templateId: string;
    templateName: string;
    result: Awaited<ReturnType<FormulaEvaluatorService['evaluateManagedFormula']>>;
  }>;
  materials: CutResult[];
  summary: {
    totalInputKg: number;
    newStockKg: number;
    reusedDeXeKg: number;
    finishedKg: number;
    reusableRemnantKg: number;
    scrapKg: number;
    newBars: number;
    reusedDeXePieces: number;
    reusableRemnantPieces: number;
    massBalanceDifferenceKg: number;
  };
};

function roundKg(value: number) {
  return Number(value.toFixed(3));
}

@Injectable()
export class ManagedCuttingPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formulaService: FormulaEvaluatorService,
    private readonly optimizer: CuttingOptimizerService,
    private readonly inventoryCommands: InventoryCommandService,
  ) {}

  async preview(userId: string, input: ManagedCuttingPlanInput): Promise<ManagedCuttingPlanResult> {
    const sets = this.validateSets(input.sets);
    const evaluated: ManagedCuttingPlanResult['sets'] = [];
    const requests = new Map<string, CutRequest>();
    let totalPieces = 0;

    for (const [index, set] of sets.entries()) {
      const result = await this.formulaService.evaluateManagedFormula(set.templateId, set.inputs);
      const setName = set.setName || `Bộ cửa ${index + 1}`;
      evaluated.push({
        setId: set.setId || `set-${index + 1}`,
        setName,
        templateId: set.templateId,
        templateName: result.metadata.templateName,
        result,
      });

      for (const line of result.aluminum) {
        const quantity = Math.max(1, Math.round(Number(line.quantity) || 0));
        totalPieces += quantity;
        if (totalPieces > 20_000) throw new BadRequestException('Phiếu cắt vượt quá 20.000 đoạn nhôm. Vui lòng chia thành nhiều phiếu.');
        const systemCode = String(line.systemCode || result.metadata.systemCode || '').trim();
        const materialCode = String(line.code || '').trim();
        const key = `${systemCode.toUpperCase()}:${materialCode.toUpperCase()}`;
        const request = requests.get(key) ?? { materialCode, systemCode, lengths: [], pieces: [] };
        const piece: CutPieceRequest = {
          lengthMm: Number(line.length_mm),
          doorName: setName,
          profileName: line.name || materialCode,
          cutAngle: line.cutAngle || '90-90',
        };
        for (let pieceIndex = 0; pieceIndex < quantity; pieceIndex += 1) request.pieces?.push({ ...piece });
        requests.set(key, request);
      }
    }

    const materials = await this.optimizer.optimizeCuts(userId, Array.from(requests.values()));
    const totalInputKg = roundKg(materials.reduce((sum, item) => sum + item.inputKg, 0));
    const finishedKg = roundKg(materials.reduce((sum, item) => sum + item.finishedKg, 0));
    const reusableRemnantKg = roundKg(materials.reduce((sum, item) => sum + item.reusableRemnantKg, 0));
    const scrapKg = roundKg(materials.reduce((sum, item) => sum + item.scrapGeneratedKg, 0));

    return {
      planRef: this.planRef(input.planRef),
      generatedAt: new Date().toISOString(),
      sets: evaluated,
      materials,
      summary: {
        totalInputKg,
        newStockKg: roundKg(materials.reduce((sum, item) => sum + item.newStockKg, 0)),
        reusedDeXeKg: roundKg(materials.reduce((sum, item) => sum + item.usedDeXeKg, 0)),
        finishedKg,
        reusableRemnantKg,
        scrapKg,
        newBars: materials.reduce((sum, item) => sum + item.newBarsNeeded, 0),
        reusedDeXePieces: materials.reduce((sum, item) => sum + item.usedDeXe.reduce((count, row) => count + row.quantity, 0), 0),
        reusableRemnantPieces: materials.reduce((sum, item) => sum + item.newDeXeGenerated.length, 0),
        massBalanceDifferenceKg: roundKg(totalInputKg - finishedKg - reusableRemnantKg - scrapKg),
      },
    };
  }

  async commitRemnants(userId: string, organizationId: string | undefined, input: ManagedCuttingPlanInput, idempotencyKey: string) {
    const plan = await this.preview(userId, input);
    return this.inventoryCommands.execute(
      {
        idempotencyKey,
        actorId: userId,
        organizationId,
        ownerType: 'USER_STOCK',
        ownerId: userId,
        command: 'COMMIT_CUTTING_PLAN',
      },
      { planRef: plan.planRef, sets: input.sets },
      async (tx) => {
        for (const material of plan.materials) {
          for (const used of material.usedDeXe) {
            const updated = await tx.inventoryItem.updateMany({
              where: { id: used.id, userId, type: 'DE_XE', quantity: { gte: used.quantity } },
              data: { quantity: { decrement: used.quantity } },
            });
            if (updated.count !== 1) {
              throw new ConflictException(`DC ${material.materialCode} đã thay đổi. Vui lòng tính lại phiếu cắt trước khi lưu kho.`);
            }
          }

          const generatedByLength = new Map<number, number>();
          material.newDeXeGenerated.forEach((lengthMm) => {
            const roundedLength = Math.round(lengthMm);
            generatedByLength.set(roundedLength, (generatedByLength.get(roundedLength) ?? 0) + 1);
          });
          for (const [lengthMm, quantity] of generatedByLength) {
            const existing = await tx.inventoryItem.findFirst({
              where: {
                userId,
                type: 'DE_XE',
                lengthMm,
                materialCode: { equals: material.materialCode, mode: 'insensitive' },
              },
              orderBy: { createdAt: 'asc' },
            });
            if (existing) {
              await tx.inventoryItem.update({ where: { id: existing.id }, data: { quantity: { increment: quantity } } });
            } else {
              await tx.inventoryItem.create({
                data: { userId, materialCode: material.materialCode, lengthMm, quantity, type: 'DE_XE' },
              });
            }
          }
        }

        if (plan.summary.scrapKg > 0) {
          await tx.user.update({ where: { id: userId }, data: { scrapKg: { increment: plan.summary.scrapKg } } });
        }

        return {
          planRef: plan.planRef,
          savedAt: new Date().toISOString(),
          reusableRemnantPieces: plan.summary.reusableRemnantPieces,
          reusableRemnantKg: plan.summary.reusableRemnantKg,
          scrapKg: plan.summary.scrapKg,
          consumedDeXePieces: plan.summary.reusedDeXePieces,
        };
      },
    );
  }

  private validateSets(rawSets: ManagedCuttingPlanSetInput[] | undefined) {
    if (!Array.isArray(rawSets) || rawSets.length === 0) throw new BadRequestException('Phiếu cắt phải có ít nhất một bộ cửa.');
    if (rawSets.length > 200) throw new BadRequestException('Một phiếu cắt chỉ được tối đa 200 bộ cửa.');
    return rawSets.map((set, index) => {
      const templateId = String(set?.templateId || '').trim();
      if (!templateId) throw new BadRequestException(`Bộ cửa ${index + 1} chưa có mã công thức.`);
      const inputs = set?.inputs && typeof set.inputs === 'object' && !Array.isArray(set.inputs) ? set.inputs : {};
      return {
        setId: String(set?.setId || '').trim(),
        setName: String(set?.setName || '').trim(),
        templateId,
        inputs,
      };
    });
  }

  private planRef(value: string | undefined) {
    const clean = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 48);
    if (clean) return clean;
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    return `PC-${stamp}`;
  }
}
