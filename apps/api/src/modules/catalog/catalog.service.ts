import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CatalogSystem, ColorCode } from '@eurohouse/types';

const EUROHOUSE_SYSTEM_NAMES: Record<string, string> = {
  'EU-55': 'Hệ 55 Euroqueen',
  'EU-TRUOT': 'Hệ trượt Châu Âu',
};

const COMPANY_COLORS: ColorCode[] = [
  { id: 'CAFE_METALIC', code: 'CAFE_METALIC', name: 'Màu Café Metalic', hex: '#4A3A2E' },
  { id: 'CAFE_THUONG', code: 'CAFE_THUONG', name: 'Màu Café thường', hex: '#3A2B20' },
  { id: 'XAM_NGOC_TRAI', code: 'XAM_NGOC_TRAI', name: 'Màu Xám Ngọc Trai', hex: '#9CA3AF' },
  { id: 'VAN_GO_CAM_LAI', code: 'VAN_GO_CAM_LAI', name: 'Màu Vân gỗ Cẩm Lai', hex: '#5A3320' },
  { id: 'VAN_GO_OLAK', code: 'VAN_GO_OLAK', name: 'Màu vân gỗ Olak', hex: '#8A5A2B' },
  { id: 'XAM_RITA', code: 'XAM_RITA', name: 'Màu Xám Rita (dự án)', hex: '#6C7176' },
];

function displaySystemName(code: string, fallback: string) {
  return EUROHOUSE_SYSTEM_NAMES[code.toUpperCase()] ?? fallback;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(): Promise<CatalogSystem[]> {
    const systems = await this.prisma.aluSystem.findMany({
      where: { code: { startsWith: 'EU-' } },
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
    const byCode = new Map(list.map((c) => [c.code, { id: c.id, code: c.code, name: c.name, hex: c.hex ?? undefined }]));
    return COMPANY_COLORS.map((color) => byCode.get(color.code) ?? color);
  }
}
