import { BadRequestException, Injectable } from '@nestjs/common';
import type { CanonicalDoorDesignRevision } from './design/door-design.types';
import { DoorDesignValidator } from './design/door-design.validator';
import { GeometryEngine } from './geometry/geometry-engine';
import { CanonicalRuleEngine } from './rules/canonical-rule-engine';
import { BomService } from './bom/bom.service';
import { CuttingEngine } from './cutting/cutting-engine';
import { PricingEngine, type PriceLookup } from './pricing/pricing-engine';
import { manufacturingFeatureFlags } from './feature-flags';

@Injectable()
export class ManufacturingService {
  constructor(
    private readonly validator: DoorDesignValidator,
    private readonly geometry: GeometryEngine,
    private readonly rules: CanonicalRuleEngine,
    private readonly bom: BomService,
    private readonly cutting: CuttingEngine,
    private readonly pricing: PricingEngine,
  ) {}

  flags() { return manufacturingFeatureFlags(); }

  async preview(input: { design: CanonicalDoorDesignRevision; prices?: PriceLookup[]; kerfMm?: number; stockLengthMm?: number; minimumReusableRemnantMm?: number }) {
    const validation = this.validator.validate(input.design);
    if (!validation.valid) throw new BadRequestException({ message: 'Door design is invalid.', errors: validation.errors, warnings: validation.warnings });
    const geometry = this.geometry.expand(input.design);
    const result = await this.rules.evaluate(input.design);
    const lines = this.bom.toLines(result.requirements.map((item) => ({ ...item, datasetRevisionId: 'PREVIEW_UNRESOLVED' })));
    const linearPieces = lines.filter((line) => line.category === 'ALUMINIUM' && line.lengthMm && line.quantity > 0).map((line) => ({ id: line.id, materialKey: line.materialStableKey ?? line.role, lengthMm: line.lengthMm!, quantity: line.quantity }));
    const cutPlan = this.cutting.optimize(linearPieces, [], {
      stockLengthMm: input.stockLengthMm ?? 6000,
      kerfMm: input.kerfMm ?? 3,
      minimumReusableRemnantMm: input.minimumReusableRemnantMm ?? 1000,
    });
    return {
      verificationStatus: 'CALCULATED_NOT_VERIFIED',
      engineVersion: result.engineVersion,
      rulePackVersion: result.rulePackVersion,
      validation,
      geometry,
      materialRequirements: result.requirements,
      bom: lines,
      cutting: cutPlan,
      pricing: this.pricing.price(lines, input.prices ?? []),
      diagnostics: result.diagnostics,
    };
  }
}
