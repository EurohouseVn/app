import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CutRequest {
  materialCode: string;
  lengths: number[]; // mm
}

export interface CutResult {
  materialCode: string;
  pieces: number[]; // original requested lengths
  usedDeXeIds: string[]; // IDs of DE_XE items from inventory that were modified/consumed
  newBarsNeeded: number; // how many new full bars were consumed
  newDeXeGenerated: number[]; // lengths of new DE_XE generated (>= 1000mm)
  scrapGeneratedKg: number; // calculated scrap weight (kg)
}

const BLADE_LOSS_MM = 5;
const DE_XE_MIN_MM = 1000;

// Mặc định cây dài 6m, trừ 3 mã KTL01, E70D150, E70D190 là 6m hoặc 5.3m (mặc định lấy 6m cho chuẩn, hoặc cấu hình sau)
function getBarLength(materialCode: string): number {
  // if (['KTL01', 'E70D150', 'E70D190'].includes(materialCode.toUpperCase())) return 5300; 
  // User said "có 2 loại 5.3m và 6m". We default to 6000 for maximum yield, 
  // unless user specifies, but for simplicity let's stick to 6000mm for all, or 5800mm if they meant standard.
  // User said: "Đối với các hệ nhôm của Eurohouse, thì chiều dài mặc định là 6m".
  return 6000; 
}

// Khối lượng trung bình 1 mét nhôm (giả định 1kg/m để tính scrap nếu chưa có số liệu chuẩn)
// Sẽ lấy từ DB Profile nếu map được, tạm thời dùng ước tính 1kg/m.
const KG_PER_MM = 1 / 1000; 

@Injectable()
export class CuttingOptimizerService {
  private readonly logger = new Logger(CuttingOptimizerService.name);

  constructor(private prisma: PrismaService) {}

  public async optimizeCuts(userId: string, requests: CutRequest[]): Promise<CutResult[]> {
    const results: CutResult[] = [];

    for (const req of requests) {
      if (req.lengths.length === 0) continue;

      // 1. Fetch available DE_XE from inventory
      const availableDeXe = await this.prisma.inventoryItem.findMany({
        where: {
          userId,
          materialCode: req.materialCode,
          type: 'DE_XE',
          quantity: { gt: 0 }
        }
      });

      // Expand quantity into individual bins
      const bins: { id: string; capacity: number; original: number; isNew: boolean }[] = [];
      for (const item of availableDeXe) {
        for (let i = 0; i < item.quantity; i++) {
          bins.push({ id: item.id, capacity: item.lengthMm, original: item.lengthMm, isNew: false });
        }
      }

      const pieces = [...req.lengths].sort((a, b) => b - a); // First Fit Decreasing
      
      let newBarsNeeded = 0;
      const barLength = getBarLength(req.materialCode);

      for (const p of pieces) {
        let placed = false;
        
        // Try to fit in existing bins
        // Sort bins by remaining capacity to minimize scrap (Best Fit)
        bins.sort((a, b) => a.capacity - b.capacity);

        for (const bin of bins) {
          if (bin.capacity >= p + BLADE_LOSS_MM) {
            bin.capacity -= (p + BLADE_LOSS_MM);
            placed = true;
            break;
          } else if (bin.capacity === p) {
             // Perfect fit, no blade loss for the rest of the piece
            bin.capacity -= p;
            placed = true;
            break;
          }
        }

        if (!placed) {
          // Open a new bar
          newBarsNeeded++;
          bins.push({
            id: 'NEW',
            capacity: barLength - (p + BLADE_LOSS_MM),
            original: barLength,
            isNew: true
          });
        }
      }

      let scrapMmTotal = 0;
      const usedDeXeIds = new Set<string>();
      const newDeXeGenerated: number[] = [];

      for (const bin of bins) {
        if (bin.capacity < bin.original) {
          if (!bin.isNew) usedDeXeIds.add(bin.id);
          
          if (bin.capacity >= DE_XE_MIN_MM) {
            newDeXeGenerated.push(bin.capacity);
          } else {
            scrapMmTotal += bin.capacity;
          }
        } else {
           // bin was untouched
        }
      }

      // Add blade loss to scrap
      const totalCuts = pieces.length;
      scrapMmTotal += totalCuts * BLADE_LOSS_MM;

      // TODO: Lookup true kg/m from Profile table if needed, using 1kg/m fallback
      const scrapGeneratedKg = scrapMmTotal * KG_PER_MM;

      results.push({
        materialCode: req.materialCode,
        pieces: req.lengths,
        usedDeXeIds: Array.from(usedDeXeIds),
        newBarsNeeded,
        newDeXeGenerated,
        scrapGeneratedKg,
      });
    }

    return results;
  }
}
