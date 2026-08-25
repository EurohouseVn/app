import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { BarCuttingLayout, CutPieceRequest, CutRequest, CutResult, VisualCutSegment } from '@eurohouse/types';

export { CutPieceRequest, CutRequest, CutResult };

const BLADE_LOSS_MM = 5; // Độ dày mạch cắt cưa nhôm
const DE_XE_MIN_MM = 1000; // Đoạn thừa >= 1000mm được lưu lại thành Đề-xê

export function calculateBarsNeeded(lengths: number[], barLengthMm: number, bladeLossMm = BLADE_LOSS_MM) {
  if (!Number.isFinite(barLengthMm) || barLengthMm <= 0) throw new BadRequestException('Chiều dài cây tiêu chuẩn không hợp lệ.');
  const bins: number[] = [];
  for (const length of [...lengths].sort((a, b) => b - a)) {
    if (!Number.isFinite(length) || length <= 0 || length > barLengthMm) {
      throw new BadRequestException(`Chiều dài cắt ${length}mm không phù hợp cây ${barLengthMm}mm.`);
    }
    let bestIndex = -1;
    let bestRemaining = Number.POSITIVE_INFINITY;
    for (let index = 0; index < bins.length; index += 1) {
      const loss = bins[index] === length ? 0 : bladeLossMm;
      const remaining = bins[index] - length - loss;
      if (remaining >= 0 && remaining < bestRemaining) {
        bestIndex = index;
        bestRemaining = remaining;
      }
    }
    if (bestIndex >= 0) bins[bestIndex] = bestRemaining;
    else bins.push(barLengthMm - length - (barLengthMm === length ? 0 : bladeLossMm));
  }
  return bins.length;
}

interface BinTracker {
  id: string;
  originalLength: number;
  remainingCapacity: number;
  isNewBar: boolean;
  cuts: VisualCutSegment[];
}

@Injectable()
export class CuttingOptimizerService {
  constructor(private readonly prisma: PrismaService) {}

  public async optimizeCuts(userId: string, requests: CutRequest[]): Promise<CutResult[]> {
    const results: CutResult[] = [];

    for (const req of requests) {
      const requestedPieces: CutPieceRequest[] = req.pieces?.length
        ? req.pieces
        : (req.lengths ?? []).map((lengthMm) => ({ lengthMm }));
      if (requestedPieces.length === 0) continue;
      if (!req.materialCode?.trim()) throw new BadRequestException('Mã thanh nhôm là bắt buộc.');

      // 1. Tra cứu thông tin Profile từ Database (khối lượng kg/m, chiều dài cây tiêu chuẩn, tên)
      const matchingProfiles = await this.prisma.profile.findMany({
        where: { code: { equals: req.materialCode.trim(), mode: 'insensitive' } },
        select: { name: true, kgPerMeter: true, barLengthMm: true, aluSystem: { select: { code: true, name: true } } },
      });
      const systemNeedle = req.systemCode?.trim().toLowerCase();
      const profilesInSystem = systemNeedle
        ? matchingProfiles.filter((item) => item.aluSystem.code.toLowerCase() === systemNeedle || item.aluSystem.name.toLowerCase() === systemNeedle)
        : matchingProfiles;
      const profile = profilesInSystem.length === 1 ? profilesInSystem[0] : undefined;
      if (!profile) {
        if (matchingProfiles.length > 1) {
          throw new BadRequestException(`Mã ${req.materialCode} tồn tại ở nhiều hệ nhôm. Vui lòng truyền đúng systemCode.`);
        }
        throw new BadRequestException(`Không tìm thấy mã ${req.materialCode} trong catalog Eurohouse.`);
      }

      const barStandardLength = profile?.barLengthMm && profile.barLengthMm > 0 ? profile.barLengthMm : 6000;
      const kgPerMeter = profile?.kgPerMeter && profile.kgPerMeter > 0 ? profile.kgPerMeter : 1.2;

      // 2. Lấy danh sách nhôm Đề-xê có sẵn trong kho của Thợ
      const availableDeXe = await this.prisma.inventoryItem.findMany({
        where: {
          userId,
          materialCode: { equals: req.materialCode.trim(), mode: 'insensitive' },
          type: 'DE_XE',
          quantity: { gt: 0 },
        },
        orderBy: { lengthMm: 'asc' }, // Ưu tiên dùng đoạn ngắn trước để giảm phế
      });

      // Tạo danh sách bins từ Đề-xê kho
      const bins: BinTracker[] = [];
      for (const item of availableDeXe) {
        for (let i = 0; i < item.quantity; i++) {
          bins.push({
            id: item.id,
            originalLength: item.lengthMm,
            remainingCapacity: item.lengthMm,
            isNewBar: false,
            cuts: [],
          });
        }
      }

      // Chuẩn hóa danh sách đoạn cần cắt
      const piecesToCut = requestedPieces.map((piece) => ({ ...piece, lengthMm: Number(piece.lengthMm) }));
      for (const piece of piecesToCut) {
        if (!Number.isFinite(piece.lengthMm) || piece.lengthMm <= 0) {
          throw new BadRequestException(`Chiều dài cắt của mã ${req.materialCode} phải lớn hơn 0.`);
        }
        if (piece.lengthMm > barStandardLength) {
          throw new BadRequestException(`Đoạn ${piece.lengthMm}mm vượt chiều dài cây ${barStandardLength}mm của mã ${req.materialCode}.`);
        }
      }

      // Sắp xếp các đoạn cắt theo chiều dài giảm dần (Best-Fit Decreasing)
      piecesToCut.sort((a, b) => b.lengthMm - a.lengthMm);

      let newBarsNeeded = 0;

      // 3. Xếp từng đoạn vào thanh phù hợp nhất (Best-Fit)
      for (const piece of piecesToCut) {
        const pLen = piece.lengthMm;
        let bestBinIndex = -1;
        let minRemainingAfterCut = Infinity;

        for (let i = 0; i < bins.length; i++) {
          const bin = bins[i];
          if (bin.remainingCapacity >= pLen + BLADE_LOSS_MM) {
            const rem = bin.remainingCapacity - (pLen + BLADE_LOSS_MM);
            if (rem < minRemainingAfterCut) {
              minRemainingAfterCut = rem;
              bestBinIndex = i;
            }
          } else if (bin.remainingCapacity === pLen) {
            bestBinIndex = i;
            break;
          }
        }

        if (bestBinIndex !== -1) {
          const chosenBin = bins[bestBinIndex];
          const loss = chosenBin.remainingCapacity === pLen ? 0 : BLADE_LOSS_MM;
          chosenBin.remainingCapacity -= (pLen + loss);
          chosenBin.cuts.push({
            lengthMm: pLen,
            doorName: piece.doorName,
            profileName: piece.profileName,
            cutAngle: piece.cutAngle || '90-90',
          });
        } else {
          // Mở 1 cây nhôm nguyên mới
          newBarsNeeded++;
          const bladeLoss = pLen === barStandardLength ? 0 : BLADE_LOSS_MM;
          const newBin: BinTracker = {
            id: `NEW_BAR_${newBarsNeeded}`,
            originalLength: barStandardLength,
            remainingCapacity: barStandardLength - (pLen + bladeLoss),
            isNewBar: true,
            cuts: [{
              lengthMm: pLen,
              doorName: piece.doorName,
              profileName: piece.profileName,
              cutAngle: piece.cutAngle || '90-90',
            }],
          };
          bins.push(newBin);
        }
      }

      // 4. Thống kê kết quả & Sơ đồ cắt chi tiết
      let scrapMmTotal = 0;
      const usedDeXeIds = new Set<string>();
      const newDeXeGenerated: number[] = [];
      const barLayouts: BarCuttingLayout[] = [];

      let barIdx = 1;
      for (const bin of bins) {
        if (bin.cuts.length === 0) continue;

        if (!bin.isNewBar) {
          usedDeXeIds.add(bin.id);
        }

        const usedLengthMm = bin.cuts.reduce((sum, c) => sum + c.lengthMm, 0);
        const remainingLengthMm = bin.remainingCapacity;
        const actualBladeLossMm = Math.max(0, bin.originalLength - remainingLengthMm - usedLengthMm);
        const isNewDeXe = remainingLengthMm >= DE_XE_MIN_MM;
        const scrapMm = isNewDeXe ? actualBladeLossMm : remainingLengthMm + actualBladeLossMm;

        if (isNewDeXe) {
          newDeXeGenerated.push(remainingLengthMm);
        } else {
          scrapMmTotal += remainingLengthMm;
        }
        scrapMmTotal += actualBladeLossMm;

        barLayouts.push({
          barIndex: barIdx++,
          barLengthMm: bin.originalLength,
          materialCode: req.materialCode,
          materialName: profile?.name || req.materialCode,
          isDeXe: !bin.isNewBar,
          deXeId: bin.isNewBar ? undefined : bin.id,
          cuts: bin.cuts,
          usedLengthMm,
          remainingLengthMm,
          isNewDeXe,
          scrapMm,
        });
      }

      const scrapGeneratedKg = Number(((scrapMmTotal / 1000) * kgPerMeter).toFixed(2));

      results.push({
        materialCode: req.materialCode,
        materialName: profile?.name || req.materialCode,
        pieces: piecesToCut.map((piece) => piece.lengthMm),
        usedDeXeIds: Array.from(usedDeXeIds),
        newBarsNeeded,
        newDeXeGenerated,
        scrapGeneratedKg,
        barLayouts,
      });
    }

    return results;
  }
}
