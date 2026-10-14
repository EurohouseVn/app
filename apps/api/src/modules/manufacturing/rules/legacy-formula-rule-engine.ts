import { Injectable } from '@nestjs/common';
import { FormulaEvaluatorService } from '../../quotations/formula-evaluator.service';
import type { CanonicalDoorDesignRevision } from '../design/door-design.types';
import type { MaterialRequirement, RuleEngine, RuleEngineResult } from './rule-engine';
import { versionIdentity } from './version-identity';

type LegacyAluminumRow = Record<string, unknown>;

@Injectable()
export class LegacyFormulaRuleEngine implements RuleEngine {
  constructor(private readonly legacy: FormulaEvaluatorService) {}

  async evaluate(design: CanonicalDoorDesignRevision, context: Record<string, unknown> = {}): Promise<RuleEngineResult> {
    const templateId = String(context.templateId ?? '');
    if (!templateId) throw new Error('Legacy templateId is required.');
    const details = await this.legacy.getTemplateDetails(templateId);
    const result = await this.legacy.evaluateTemplate(templateId, {
      ...(context.inputs && typeof context.inputs === 'object' ? context.inputs : {}),
      width: design.widthMm,
      height: design.heightMm,
      quantity: 1,
    });
    const requirements: MaterialRequirement[] = ((result.aluminum ?? []) as LegacyAluminumRow[]).map((row, index) => ({
      id: `legacy:${templateId}:${index}`,
      category: 'ALUMINIUM',
      role: 'OTHER',
      componentId: `legacy-row-${index}`,
      quantity: Number(row.quantity) || 0,
      unit: 'piece',
      lengthMm: Number(row.length_mm) || 0,
      attributes: { legacyProfileCode: String(row.code ?? ''), angle: String(row.angle ?? '') },
      constraints: { unresolvedLegacyProfile: true },
      sourceRule: `LEGACY_TEMPLATE:${templateId}`,
    }));
    return {
      engineVersion: versionIdentity('legacy-engine', { evaluator: 'FormulaEvaluatorService', contract: 1 }),
      rulePackVersion: versionIdentity('legacy-template', { templateId, updatedAt: details.updatedAt, filePath: details.filePath }),
      requirements,
      diagnostics: [{
        code: 'LEGACY_NOT_VERIFIED',
        severity: 'WARNING',
        message: 'Legacy formula calculated successfully but its manufacturing compatibility is not verified.',
      }],
      rawLegacyResult: result,
    };
  }
}
