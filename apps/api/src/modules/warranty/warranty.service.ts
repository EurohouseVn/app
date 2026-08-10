import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActivateWarrantyInput, ActivateWarrantyResult, WarrantyRecord } from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';

@Injectable()
export class WarrantyService {
  constructor(private readonly prisma: PrismaService) {}

  private hasGlobalWarrantyAccess(user?: JwtUser): boolean {
    return !user || user.isCeo === true || user.role === 'ADMIN' || user.role === 'STAFF';
  }

  private assertCanAccessWarranty(warranty: { activatedById: string | null }, user?: JwtUser) {
    if (this.hasGlobalWarrantyAccess(user)) return;
    if (warranty.activatedById === user?.sub) return;
    throw new ForbiddenException('Khong co quyen truy cap bao hanh nay.');
  }

  private async nextWarrantyCode(): Promise<string> {
    const count = await this.prisma.warranty.count();
    const now = new Date();
    const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `BH-${ymd}-${String(count + 1).padStart(2, '0')}`;
  }

  private toWarrantyRecord(w: {
    id: string; code: string; serialCode: string; productName: string; systemCode: string;
    customerName: string; customerPhone: string; customerAddress: string; projectName: string; warrantyMonths: number;
    activatedByName: string; pointsAwarded: number; status: string; activatedAt: Date; expiresAt: Date | null;
  }): WarrantyRecord {
    return {
      id: w.id, code: w.code, serialCode: w.serialCode, productName: w.productName, systemCode: w.systemCode,
      customerName: w.customerName, customerPhone: w.customerPhone, customerAddress: w.customerAddress, projectName: w.projectName,
      warrantyMonths: w.warrantyMonths, activatedByName: w.activatedByName, pointsAwarded: w.pointsAwarded,
      status: w.status as WarrantyRecord['status'], activatedAt: w.activatedAt.toISOString(),
      expiresAt: w.expiresAt?.toISOString(),
    };
  }

  async activateWarranty(input: ActivateWarrantyInput, userId?: string): Promise<ActivateWarrantyResult> {
    const serialCode = (input.serialCode ?? '').trim();
    if (!serialCode) throw new BadRequestException('Vui lòng nhập hoặc quét mã sản phẩm.');

    const existing = await this.prisma.warranty.findUnique({ where: { serialCode } });
    if (existing) throw new BadRequestException('Mã này đã được kích hoạt bảo hành trước đó.');

    const user = userId ? await this.prisma.user.findUnique({ where: { id: userId } }) : null;
    const months = input.warrantyMonths ?? 24;
    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt);
    expiresAt.setMonth(expiresAt.getMonth() + months);
    const code = await this.nextWarrantyCode();

    const pointsAwarded = user ? 2 : 0;
    
    // Tạo bảo hành
    const created = await this.prisma.warranty.create({
      data: {
        code, serialCode,
        productName: input.productName ?? '',
        systemCode: input.systemCode ?? '',
        customerName: input.customerName ?? '',
        customerPhone: input.customerPhone ?? '',
        customerAddress: input.customerAddress ?? '',
        projectName: input.projectName ?? '',
        warrantyMonths: months,
        activatedById: userId ?? null,
        activatedByName: user?.displayName ?? '',
        pointsAwarded,
        activatedAt,
        expiresAt,
      },
    });

    let newBalance = user?.points ?? 0;
    if (user && pointsAwarded > 0) {
      newBalance += pointsAwarded;
      await this.prisma.user.update({ where: { id: user.id }, data: { points: newBalance } });
      await this.prisma.pointLedger.create({
        data: {
          userId: user.id,
          reason: 'WARRANTY',
          delta: pointsAwarded,
          balanceAfter: newBalance,
          refId: created.id,
          note: `Kích hoạt mã bảo hành ${serialCode}`,
        }
      });
    }

    return { warranty: this.toWarrantyRecord(created), pointsAwarded, pointsBalance: newBalance };
  }

  async listWarranties(filter?: { activatedById?: string }): Promise<WarrantyRecord[]> {
    const list = await this.prisma.warranty.findMany({
      where: { activatedById: filter?.activatedById },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((w) => this.toWarrantyRecord(w));
  }

  async getWarranty(id: string, user?: JwtUser): Promise<WarrantyRecord> {
    const warranty = await this.prisma.warranty.findFirst({ where: { OR: [{ id }, { code: id }, { serialCode: id }] } });
    if (!warranty) throw new NotFoundException('Không tìm thấy bảo hành.');
    this.assertCanAccessWarranty(warranty, user);
    return this.toWarrantyRecord(warranty);
  }
}
