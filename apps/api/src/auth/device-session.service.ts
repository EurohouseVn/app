import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type DeviceKind = 'DESKTOP' | 'PHONE';

/** Mỗi NPP đăng nhập song song tối đa 2 máy tính và 3 điện thoại (docs/design/NPP_GLASS_BARCODE_STOCK_DESIGN.md mục 6). */
export const DEVICE_LIMITS: Record<DeviceKind, number> = { DESKTOP: 2, PHONE: 3 };

/** Phiên thiết bị hết hạn cùng lúc với token đăng nhập (7 ngày, xem auth.module.ts). */
export const DEVICE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const TOUCH_INTERVAL_MS = 60_000;

export type DeviceSessionInfo = { id: string; kind: DeviceKind; label: string; createdAt: string; lastSeenAt: string; current: boolean };

/** Loại thiết bị: ưu tiên tiêu đề do web gửi lên, sau đó đoán theo User-Agent, mặc định là máy tính. */
export function resolveDeviceKind(headerValue?: string, userAgent?: string): DeviceKind {
  const header = (headerValue ?? '').trim().toUpperCase();
  if (header === 'PHONE' || header === 'DESKTOP') return header;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent ?? '') ? 'PHONE' : 'DESKTOP';
}

type SessionRow = { id: string; nppOrgId: string; userId: string; kind: string; label: string; createdAt: Date; lastSeenAt: Date; revokedAt: Date | null };

const toInfo = (row: SessionRow, currentSid?: string): DeviceSessionInfo => ({
  id: row.id,
  kind: row.kind as DeviceKind,
  label: row.label,
  createdAt: row.createdAt.toISOString(),
  lastSeenAt: row.lastSeenAt.toISOString(),
  current: row.id === currentSid,
});

@Injectable()
export class DeviceSessionService {
  constructor(private readonly prisma: PrismaService) {}

  private liveSince() {
    return new Date(Date.now() - DEVICE_SESSION_TTL_MS);
  }

  /**
   * Tạo phiên cho một lần đăng nhập. Đã đủ số máy cùng loại thì báo DEVICE_LIMIT kèm danh sách để người dùng chọn gỡ một máy;
   * gửi lại kèm revokeSessionId (cùng NPP, cùng loại) thì gỡ máy đó rồi cho đăng nhập.
   * Khóa tư vấn theo NPP để hai lần đăng nhập cùng lúc không vượt quá giới hạn.
   */
  async register(input: { userId: string; organizationId: string; kind: DeviceKind; label: string; userAgent?: string; revokeSessionId?: string }): Promise<{ id: string }> {
    const { organizationId, kind } = input;
    const limit = DEVICE_LIMITS[kind];
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`npp-device:${organizationId}`}))`;
      const active = (await tx.nppDeviceSession.findMany({
        where: { nppOrgId: organizationId, kind, revokedAt: null, createdAt: { gt: this.liveSince() } },
        orderBy: { createdAt: 'asc' },
      })) as SessionRow[];
      if (active.length >= limit) {
        const replace = input.revokeSessionId ? active.find((s) => s.id === input.revokeSessionId) : undefined;
        if (!replace) {
          const noun = kind === 'PHONE' ? 'điện thoại' : 'máy tính';
          throw new ConflictException({
            statusCode: 409,
            code: 'DEVICE_LIMIT',
            message: `Đã đủ ${limit} ${noun} đang đăng nhập. Hãy chọn một ${noun} để đăng xuất rồi đăng nhập lại.`,
            kind,
            limit,
            devices: active.map((s) => toInfo(s)),
          });
        }
        await tx.nppDeviceSession.updateMany({ where: { id: replace.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      const row = (await tx.nppDeviceSession.create({
        data: { nppOrgId: organizationId, userId: input.userId, kind, label: input.label.slice(0, 80), userAgent: (input.userAgent ?? '').slice(0, 300) },
      })) as SessionRow;
      return { id: row.id };
    });
  }

  /** Dùng ở mỗi request mang token có sid: phiên đã bị gỡ hoặc hết hạn thì từ chối ngay, không đợi token hết hạn. */
  async assertActive(sid: string): Promise<void> {
    const row = (await this.prisma.nppDeviceSession.findUnique({ where: { id: sid } })) as SessionRow | null;
    if (!row || row.revokedAt || row.createdAt.getTime() < this.liveSince().getTime()) {
      throw new UnauthorizedException('Thiết bị này đã bị đăng xuất. Vui lòng đăng nhập lại.');
    }
    if (Date.now() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.nppDeviceSession
        .updateMany({ where: { id: sid, lastSeenAt: { lt: new Date(Date.now() - TOUCH_INTERVAL_MS) } }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }
  }

  async listActive(organizationId: string, currentSid?: string): Promise<DeviceSessionInfo[]> {
    const rows = (await this.prisma.nppDeviceSession.findMany({
      where: { nppOrgId: organizationId, revokedAt: null, createdAt: { gt: this.liveSince() } },
      orderBy: { createdAt: 'asc' },
    })) as SessionRow[];
    return rows.map((row) => toInfo(row, currentSid));
  }

  async revoke(organizationId: string, id: string): Promise<void> {
    const row = await this.prisma.nppDeviceSession.findFirst({ where: { id, nppOrgId: organizationId } });
    if (!row) throw new NotFoundException('Không tìm thấy thiết bị.');
    await this.prisma.nppDeviceSession.updateMany({ where: { id, nppOrgId: organizationId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Đăng xuất chính phiên đang dùng. */
  async revokeById(sid: string): Promise<void> {
    await this.prisma.nppDeviceSession.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
