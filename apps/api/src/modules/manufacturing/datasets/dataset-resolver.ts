import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { MaterialRequirement, RuleDiagnostic } from '../rules/rule-engine';

export type ResolvedMaterialRequirement = MaterialRequirement & {
  datasetRevisionId: string;
  materialStableKey?: string;
  materialCode?: string;
  profileRevisionId?: string;
};

export type DatasetRoleMappingContract = {
  roleCode: string;
  profileRevision: { id: string; stableKey: string; code: string; stockLengthMm: number; kgPerMeter: number };
};

export function resolveMaterialRequirements(
  datasetRevisionId: string,
  requirements: MaterialRequirement[],
  mappings: DatasetRoleMappingContract[],
): { requirements: ResolvedMaterialRequirement[]; diagnostics: RuleDiagnostic[] } {
  const diagnostics: RuleDiagnostic[] = [];
  const resolved = requirements.map((requirement) => {
    if (requirement.category !== 'ALUMINIUM') return { ...requirement, datasetRevisionId };
    const mapping = mappings.find((item) => item.roleCode === requirement.role);
    if (!mapping) {
      diagnostics.push({ code: 'DATASET_ROLE_UNRESOLVED', severity: 'ERROR', message: `No profile is mapped to role ${requirement.role}.`, componentId: requirement.componentId });
      return { ...requirement, datasetRevisionId };
    }
    return {
      ...requirement,
      datasetRevisionId,
      materialStableKey: mapping.profileRevision.stableKey,
      materialCode: mapping.profileRevision.code,
      profileRevisionId: mapping.profileRevision.id,
      attributes: { ...requirement.attributes, stockLengthMm: mapping.profileRevision.stockLengthMm, kgPerMeter: mapping.profileRevision.kgPerMeter },
    };
  });
  return { requirements: resolved, diagnostics };
}

@Injectable()
export class DatasetResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    datasetRevisionId: string,
    systemStableKey: string,
    requirements: MaterialRequirement[],
  ): Promise<{ requirements: ResolvedMaterialRequirement[]; diagnostics: RuleDiagnostic[] }> {
    const revision = await this.prisma.datasetRevision.findUnique({
      where: { id: datasetRevisionId },
      include: {
        systems: {
          where: { stableKey: systemStableKey },
          include: {
            roleMappings: {
              orderBy: { priority: 'asc' },
              include: { profileRevision: true },
            },
          },
        },
      },
    });
    if (!revision) throw new BadRequestException('Dataset revision does not exist.');
    if (revision.status !== 'RELEASED') throw new BadRequestException('DATASET_NOT_RELEASED: only a released dataset revision can resolve a BOM.');
    const system = revision.systems[0];
    if (!system) throw new BadRequestException(`System ${systemStableKey} is not present in the selected dataset revision.`);

    const resolved = resolveMaterialRequirements(datasetRevisionId, requirements, system.roleMappings);
    resolved.diagnostics.forEach((item) => { item.message = `${item.message.replace(/\.$/, '')} in ${systemStableKey}.`; });
    return resolved;
  }
}
