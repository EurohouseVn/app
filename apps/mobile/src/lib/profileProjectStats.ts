export type ProfileProjectMetric = {
  finalAmount: number;
  estimatedAmount: number;
  expectedProfit: number;
};

export function summarizeProfileProjects(projects: ProfileProjectMetric[]) {
  const totalRevenue = projects.reduce(
    (sum, project) => sum + Number(project.finalAmount || project.estimatedAmount || 0),
    0,
  );
  const totalProfit = projects.reduce((sum, project) => sum + Number(project.expectedProfit || 0), 0);
  const margin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0;

  return {
    projectCount: projects.length,
    totalRevenue,
    totalProfit,
    margin,
  };
}
