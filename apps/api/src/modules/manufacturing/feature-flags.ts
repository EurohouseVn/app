import { ServiceUnavailableException } from '@nestjs/common';

export const MANUFACTURING_FEATURE_FLAGS = {
  canonicalDesign: 'V2_CANONICAL_DESIGN_ENABLED',
  datasetResolver: 'V2_DATASET_RESOLVER_ENABLED',
  persistentBom: 'V2_PERSISTENT_BOM_ENABLED',
  cuttingEngine: 'V2_CUTTING_ENGINE_ENABLED',
  datasetStudio: 'EUROHOUSE_DATASET_STUDIO',
  traceInspector: 'MANUFACTURING_TRACE_UI',
  shadowMode: 'MANUFACTURING_SHADOW_MODE',
  bomReview: 'BOM_REVIEW_WORKFLOW',
} as const;

export function manufacturingFeatureFlags(env: NodeJS.ProcessEnv = process.env) {
  return Object.fromEntries(Object.entries(MANUFACTURING_FEATURE_FLAGS).map(([name, key]) => [name, env[key] === 'true']));
}

export type ManufacturingFeatureName = keyof typeof MANUFACTURING_FEATURE_FLAGS;

export function assertManufacturingFeatureEnabled(name: ManufacturingFeatureName, env: NodeJS.ProcessEnv = process.env) {
  if (env[MANUFACTURING_FEATURE_FLAGS[name]] !== 'true') {
    throw new ServiceUnavailableException(`${MANUFACTURING_FEATURE_FLAGS[name]} is disabled in this environment.`);
  }
}
