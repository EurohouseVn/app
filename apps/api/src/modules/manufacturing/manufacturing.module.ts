import { Module } from '@nestjs/common';
import { QuotationsModule } from '../quotations/quotations.module';
import { BomService } from './bom/bom.service';
import { ComparisonService } from './comparison/comparison.service';
import { CuttingEngine } from './cutting/cutting-engine';
import { DatasetStudioController } from './datasets/dataset-studio.controller';
import { DatasetCoverageService } from './datasets/dataset-coverage.service';
import { DatasetStudioService } from './datasets/dataset-studio.service';
import { LegacyBfdCuttingAdapter } from './cutting/legacy-bfd-cutting.adapter';
import { DatasetResolver } from './datasets/dataset-resolver';
import { DoorDesignValidator } from './design/door-design.validator';
import { GeometryEngine } from './geometry/geometry-engine';
import { ManufacturingController } from './manufacturing.controller';
import { ManufacturingService } from './manufacturing.service';
import { NestingEngine } from './nesting/nesting-engine';
import { PricingEngine } from './pricing/pricing-engine';
import { CanonicalRuleEngine } from './rules/canonical-rule-engine';
import { LegacyFormulaRuleEngine } from './rules/legacy-formula-rule-engine';
import { RuleProvenanceController } from './rules/rule-provenance.controller';
import { RuleProvenanceService } from './rules/rule-provenance.service';
import { TechnicalSourceController } from './sources/technical-source.controller';
import { TechnicalSourceService } from './sources/technical-source.service';
import { CalculationTraceService } from './trace/calculation-trace.service';
import { TraceInspectorController } from './trace/trace-inspector.controller';
import { TraceInspectorService } from './trace/trace-inspector.service';
import { GoldenFixtureService } from './verification/golden-fixture.service';
import { ExpectedOutputService } from './verification/expected-output.service';
import { VerificationController } from './verification/verification.controller';

@Module({
  imports: [QuotationsModule],
  controllers: [ManufacturingController, DatasetStudioController, RuleProvenanceController, TechnicalSourceController, VerificationController, TraceInspectorController],
  providers: [
    DoorDesignValidator,
    GeometryEngine,
    CanonicalRuleEngine,
    LegacyFormulaRuleEngine,
    DatasetResolver,
    BomService,
    CuttingEngine,
    LegacyBfdCuttingAdapter,
    NestingEngine,
    PricingEngine,
    CalculationTraceService,
    DatasetStudioService,
    DatasetCoverageService,
    RuleProvenanceService,
    TechnicalSourceService,
    ComparisonService,
    ExpectedOutputService,
    GoldenFixtureService,
    TraceInspectorService,
    ManufacturingService,
  ],
  exports: [DatasetResolver, BomService, CuttingEngine, NestingEngine, PricingEngine, CalculationTraceService],
})
export class ManufacturingModule {}
