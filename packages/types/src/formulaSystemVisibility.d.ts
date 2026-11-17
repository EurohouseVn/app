export type CuttingFormulaSystemIdentity = {
  code?: string | null;
  name?: string | null;
};

export declare function isCuttingFormulaSystemVisible(system: CuttingFormulaSystemIdentity): boolean;

export declare function filterCuttingFormulaSystems<T extends CuttingFormulaSystemIdentity>(systems: T[]): T[];
