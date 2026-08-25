import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateBarsNeeded } from './cutting-optimizer.service';
import { FormulaEvaluatorService } from './formula-evaluator.service';

type QuotationBomItem = {
  templateId: string | null;
  system: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
  color: string | null;
  dynamicInputs: unknown;
  formulaSnapshot?: unknown;
};

function normalizeLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function codeCandidates(value: string) {
  const exact = value.trim().toUpperCase();
  const withoutFormulaSuffix = exact.endsWith('M') ? exact.slice(0, -1) : exact;
  return new Set([exact, withoutFormulaSuffix]);
}

@Injectable()
export class QuotationBomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formulaService: FormulaEvaluatorService,
  ) {}

  async buildOrderItems(
    quotationItems: QuotationBomItem[],
    options: { defaultColor: string; customItemQuantities?: Record<string, number> },
  ) {
    const [systems, profiles] = await Promise.all([
      this.prisma.aluSystem.findMany({ select: { id: true, code: true, name: true } }),
      this.prisma.profile.findMany({
        select: {
          id: true,
          aluSystemId: true,
          code: true,
          name: true,
          kgPerMeter: true,
          barLengthMm: true,
        },
      }),
    ]);
    const errors = new Set<string>();
    const demand = new Map<string, { profile: (typeof profiles)[number]; colorCode: string; lengths: number[] }>();

    for (const item of quotationItems) {
      if (!item.templateId) {
        errors.add('Có bộ cửa chưa chọn mẫu công thức.');
        continue;
      }
      const systemNeedle = normalizeLookup(item.system || '');
      const system = systems.find((candidate) =>
        [candidate.code, candidate.name].some((value) => normalizeLookup(value) === systemNeedle),
      );
      if (!system) {
        errors.add(`Không nhận diện được hệ Eurohouse "${item.system || '(trống)'}".`);
        continue;
      }

      const dynamicInputs = item.dynamicInputs && typeof item.dynamicInputs === 'object'
        ? item.dynamicInputs as Record<string, unknown>
        : {};
      const snapshot = item.formulaSnapshot && typeof item.formulaSnapshot === 'object'
        ? item.formulaSnapshot as { result?: any }
        : undefined;
      const result = snapshot?.result ?? await this.formulaService.evaluateTemplate(item.templateId, {
        ...dynamicInputs,
        width: item.widthMm,
        height: item.heightMm,
        quantity: item.quantity,
      });

      for (const row of result.aluminum ?? []) {
        const sourceCode = String(row.code || '').trim();
        const lengthMm = Number(row.length_mm);
        const quantity = Number(row.quantity);
        if (!sourceCode || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(lengthMm) || lengthMm <= 0) continue;
        if (quantity > 10000) throw new BadRequestException(`Số đoạn cắt của mã ${sourceCode} vượt giới hạn an toàn.`);

        const codes = codeCandidates(sourceCode);
        const matches = profiles.filter((profile) => profile.aluSystemId === system.id && codes.has(profile.code.toUpperCase()));
        if (matches.length !== 1) {
          errors.add(`Mã tham chiếu ${sourceCode} chưa ánh xạ duy nhất vào ${system.name}.`);
          continue;
        }
        const profile = matches[0];
        const colorCode = item.color || options.defaultColor;
        const key = `${profile.id}:${colorCode}`;
        const bucket = demand.get(key) ?? { profile, colorCode, lengths: [] };
        for (let index = 0; index < quantity; index += 1) bucket.lengths.push(lengthMm);
        demand.set(key, bucket);
      }
    }

    if (errors.size > 0) {
      throw new BadRequestException(`Chưa thể tạo đơn chính xác: ${Array.from(errors).join(' ')}`);
    }
    if (demand.size === 0) throw new BadRequestException('Công thức không sinh được thanh nhôm để đặt hàng.');

    return Array.from(demand.values()).map(({ profile, colorCode, lengths }) => {
      const calculatedBars = calculateBarsNeeded(lengths, profile.barLengthMm);
      const override = options.customItemQuantities?.[profile.id];
      const quantity = override === undefined ? calculatedBars : Math.trunc(Number(override));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(`Số cây đặt cho mã ${profile.code} phải lớn hơn 0.`);
      }
      return {
        profileId: profile.id,
        productCode: profile.code,
        productName: profile.name,
        colorCode,
        quantity,
        kgPerMeter: profile.kgPerMeter,
      };
    });
  }
}
