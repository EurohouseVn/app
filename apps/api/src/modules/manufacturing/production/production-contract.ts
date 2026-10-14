export type ProductionJobInput = {
  bomRevisionId: string;
  cutPlanReference?: string;
  quantity: number;
  dueAt?: string;
};

export interface ProductionGateway {
  createJob(input: ProductionJobInput): Promise<{ jobReference: string }>;
}
