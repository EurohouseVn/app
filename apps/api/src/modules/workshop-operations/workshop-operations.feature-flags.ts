export const WORKSHOP_OPERATIONS_FEATURE_FLAGS = {
  survey: 'WORKSHOP_SURVEY_V2',
  inventory: 'INVENTORY_V2',
  shopFloor: 'SHOP_FLOOR_V2',
  quality: 'QC_V2',
  installation: 'INSTALLATION_V2',
  warranty: 'WARRANTY_V2',
} as const;

export type WorkshopOperationsFeature = keyof typeof WORKSHOP_OPERATIONS_FEATURE_FLAGS;

export function workshopOperationsFeatureFlags(env: NodeJS.ProcessEnv = process.env) {
  return Object.fromEntries(
    Object.entries(WORKSHOP_OPERATIONS_FEATURE_FLAGS).map(([name, key]) => [name, env[key] === 'true']),
  ) as Record<WorkshopOperationsFeature, boolean>;
}

export function assertWorkshopOperationsFeature(
  feature: WorkshopOperationsFeature,
  env: NodeJS.ProcessEnv = process.env,
) {
  // Compatibility shim for Track A controller methods. Track B enforcement
  // is tenant-scoped in WorkshopPilotGuard.
  void feature;
  void env;
}
