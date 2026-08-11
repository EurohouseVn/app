import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CatalogSystem, ColorCode } from '@eurohouse/types';

const EUROHOUSE_SYSTEM_NAMES: Record<string, string> = {
  'EU-55': 'Hệ 55 Euroqueen',
  'EU-TRUOT': 'Hệ trượt Châu Âu',
};

function displaySystemName(code: string, fallback: string) {
  return EUROHOUSE_SYSTEM_NAMES[code.toUpperCase()] ?? fallback;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(): Promise<CatalogSystem[]> {
    const systems = await this.prisma.aluSystem.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { profiles: { orderBy: { code: 'asc' } } },
    });
    return systems.map((s) => ({
      id: s.id, code: s.code, name: displaySystemName(s.code, s.name), description: s.description ?? undefined,
      profiles: s.profiles.map((p) => ({
        id: p.id, code: p.code, name: p.name, thicknessMm: p.thicknessMm ?? undefined,
        kgPerMeter: p.kgPerMeter, barLengthMm: p.barLengthMm, barsPerBundle: p.barsPerBundle,
        pricePerKg: p.pricePerKg, imageUrl: p.imageUrl ?? undefined,
      })),
    }));
  }

  async colors(): Promise<ColorCode[]> {
    const list = await this.prisma.colorCode.findMany({ orderBy: { name: 'asc' } });
    return list.map((c) => ({ id: c.id, code: c.code, name: c.name, hex: c.hex ?? undefined }));
  }
}
