import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type {
  CreateWorkshopPayAdjustmentInput,
  CreateWorkshopPieceJobInput,
  CreateWorkshopReminderInput,
  CreateWorkshopWorkerInput,
  SetWorkshopDayStatusInput,
  WorkforceDashboard,
  WorkshopAttendance as WorkshopAttendanceDto,
  WorkshopAttendanceStatus,
  WorkshopPayAdjustment as WorkshopPayAdjustmentDto,
  WorkshopPayAdjustmentKind,
  WorkshopPayrollMonth,
  WorkshopPayrollRow,
  WorkshopPayslip,
  WorkshopPayslipView,
  WorkshopPayType,
  WorkshopPieceJob as WorkshopPieceJobDto,
  WorkshopReminder as WorkshopReminderDto,
  WorkshopWorkdaySetting,
  WorkshopWorker as WorkshopWorkerDto,
} from '@eurohouse/types';
import type { Prisma, WorkshopReminder as PrismaWorkshopReminder, WorkshopWorker as PrismaWorkshopWorker } from '@prisma/client';
import type { JwtUser } from '../../auth/current-user.decorator';
import type { PdfIssuerProfile } from '../../common/pdf-document.util';
import { PrismaService } from '../../prisma/prisma.service';
import { computePayslip, type PayslipAdjustment, type PayslipDay, type PayslipPiece } from './payslip';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const PAY_TYPES = new Set<WorkshopPayType>(['DAILY', 'HOURLY', 'MONTHLY']);
const DAY_STATUSES = new Set<WorkshopAttendanceStatus>(['PRESENT', 'HALF', 'LEAVE', 'UNPAID_LEAVE', 'ABSENT']);
const ADJUSTMENT_KINDS = new Set<WorkshopPayAdjustmentKind>(['ADVANCE', 'BONUS', 'PENALTY']);
const ADJUSTMENT_LABEL: Record<WorkshopPayAdjustmentKind, string> = { ADVANCE: 'Tạm ứng', BONUS: 'Thưởng', PENALTY: 'Phạt' };

/** Đồng hồ thay được trong test. */
export const WORKFORCE_CLOCK = Symbol('WORKFORCE_CLOCK');

function localDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function parseDateText(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Ngày phải có định dạng YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Ngày không hợp lệ.');
  return date;
}

function monthRange(month: string): { month: string; start: Date; end: Date } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Tháng phải có định dạng YYYY-MM.');
  const [year, monthNumber] = month.split('-').map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new BadRequestException('Tháng không hợp lệ.');
  return { month, start: new Date(Date.UTC(year, monthNumber - 1, 1)), end: new Date(Date.UTC(year, monthNumber, 1)) };
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-');
  return `${monthNumber}/${year}`;
}

function roundHours(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

function payPercent(value: unknown, fallback: number): number {
  const normalized = Math.round(Number(value));
  return Number.isFinite(normalized) ? Math.min(1_000, Math.max(100, normalized)) : fallback;
}

function nonNegativeInt(value: unknown): number {
  return Math.max(0, Math.round(Number(value) || 0));
}

/** "9.000.000", "1,5" — số kiểu Việt Nam, không phụ thuộc ICU của máy chủ. */
export function viNumber(value: number): string {
  const negative = value < 0;
  const [integer, fraction] = Math.abs(value).toString().split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${grouped}${fraction ? `,${fraction.slice(0, 2)}` : ''}`;
}

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

type PayrollData = {
  attendance: Array<{ workerId: string; workDate: Date; status: string; regularHours: number; overtimeHours: number }>;
  holidays: string[];
  shares: Array<{ workerId: string; amount: number; job: { title: string; projectName: string; workDate: Date } }>;
  adjustments: Array<{ workerId: string; kind: string; amount: number; note: string; workDate: Date }>;
};

@Injectable()
export class WorkforceService {
  private readonly now: () => Date;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(WORKFORCE_CLOCK) now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  private today(): string {
    return localDate(this.now());
  }

  private parseDate(value?: string): Date {
    return parseDateText(value?.trim() || this.today());
  }

  private parseMonth(value?: string) {
    return monthRange(value?.trim() || this.today().slice(0, 7));
  }

  private organizationId(user: JwtUser): string {
    if (!user.organizationId) throw new ForbiddenException('Tài khoản chưa được gắn với cơ sở sản xuất.');
    return user.organizationId;
  }

  private async scopedWorker(user: JwtUser, id: string): Promise<PrismaWorkshopWorker> {
    const worker = await this.prisma.workshopWorker.findFirst({
      where: { id, organizationId: this.organizationId(user) },
    });
    if (!worker) throw new NotFoundException('Không tìm thấy nhân sự trong cơ sở sản xuất này.');
    return worker;
  }

  private async monthClose(organizationId: string, month: string) {
    return this.prisma.workshopPayrollClose.findUnique({
      where: { organizationId_month: { organizationId, month } },
    });
  }

  /** Tháng đã chốt lương thì chấm công, khoán, tạm ứng của tháng đó bị khoá. */
  private async assertMonthOpen(organizationId: string, date: Date) {
    const month = dateKey(date).slice(0, 7);
    if (await this.monthClose(organizationId, month)) {
      throw new BadRequestException(`Tháng ${monthLabel(month)} đã chốt lương. Mở lại tháng để sửa.`);
    }
  }

  private toWorker(worker: PrismaWorkshopWorker): WorkshopWorkerDto {
    return {
      ...worker,
      payType: worker.payType as WorkshopPayType,
      createdAt: worker.createdAt.toISOString(),
      updatedAt: worker.updatedAt.toISOString(),
    };
  }

  private toReminder(reminder: PrismaWorkshopReminder): WorkshopReminderDto {
    return {
      ...reminder,
      priority: reminder.priority as WorkshopReminderDto['priority'],
      dueAt: reminder.dueAt.toISOString(),
      completedAt: reminder.completedAt?.toISOString() ?? null,
      createdAt: reminder.createdAt.toISOString(),
      updatedAt: reminder.updatedAt.toISOString(),
    };
  }

  private toAttendance(
    attendance: Prisma.WorkshopAttendanceGetPayload<{ include: { worker: true } }>,
  ): WorkshopAttendanceDto {
    return {
      ...attendance,
      worker: this.toWorker(attendance.worker),
      status: attendance.status as WorkshopAttendanceDto['status'],
      workDate: attendance.workDate.toISOString(),
      checkInAt: attendance.checkInAt?.toISOString() ?? null,
      checkOutAt: attendance.checkOutAt?.toISOString() ?? null,
      createdAt: attendance.createdAt.toISOString(),
      updatedAt: attendance.updatedAt.toISOString(),
    };
  }

  // ---------- Thợ ----------

  async workers(user: JwtUser, includeInactive = false) {
    return this.prisma.workshopWorker.findMany({
      where: { organizationId: this.organizationId(user), ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async createWorker(user: JwtUser, input: CreateWorkshopWorkerInput) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('Vui lòng nhập tên thợ.');
    if (!PAY_TYPES.has(input.payType)) throw new BadRequestException('Hình thức tính lương không hợp lệ.');
    return this.prisma.workshopWorker.create({
      data: {
        organizationId: this.organizationId(user),
        name,
        phone: input.phone?.trim() || '',
        roleName: input.roleName?.trim() || 'Thợ sản xuất',
        payType: input.payType,
        baseRate: nonNegativeInt(input.baseRate),
        overtimeRate: nonNegativeInt(input.overtimeRate),
        standardMonthlyDays: Math.min(31, Math.max(1, Math.round(Number(input.standardMonthlyDays) || 26))),
        sundayPayEnabled: Boolean(input.sundayPayEnabled),
        sundayPayPercent: payPercent(input.sundayPayPercent, 200),
        holidayPayEnabled: Boolean(input.holidayPayEnabled),
        holidayPayPercent: payPercent(input.holidayPayPercent, 300),
        insuranceEnabled: Boolean(input.insuranceEnabled),
        insuranceSalary: nonNegativeInt(input.insuranceSalary),
        paidLeaveDaysPerMonth: Math.min(31, input.paidLeaveDaysPerMonth === undefined ? 1 : nonNegativeInt(input.paidLeaveDaysPerMonth)),
      },
    });
  }

  async updateWorker(user: JwtUser, id: string, input: Partial<CreateWorkshopWorkerInput> & { active?: boolean }) {
    await this.scopedWorker(user, id);
    if (input.payType && !PAY_TYPES.has(input.payType)) throw new BadRequestException('Hình thức tính lương không hợp lệ.');
    return this.prisma.workshopWorker.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
        ...(input.roleName !== undefined ? { roleName: input.roleName.trim() } : {}),
        ...(input.payType !== undefined ? { payType: input.payType } : {}),
        ...(input.baseRate !== undefined ? { baseRate: nonNegativeInt(input.baseRate) } : {}),
        ...(input.overtimeRate !== undefined ? { overtimeRate: nonNegativeInt(input.overtimeRate) } : {}),
        ...(input.standardMonthlyDays !== undefined
          ? { standardMonthlyDays: Math.min(31, Math.max(1, Math.round(Number(input.standardMonthlyDays) || 26))) }
          : {}),
        ...(input.sundayPayEnabled !== undefined ? { sundayPayEnabled: Boolean(input.sundayPayEnabled) } : {}),
        ...(input.sundayPayPercent !== undefined ? { sundayPayPercent: payPercent(input.sundayPayPercent, 200) } : {}),
        ...(input.holidayPayEnabled !== undefined ? { holidayPayEnabled: Boolean(input.holidayPayEnabled) } : {}),
        ...(input.holidayPayPercent !== undefined ? { holidayPayPercent: payPercent(input.holidayPayPercent, 300) } : {}),
        ...(input.insuranceEnabled !== undefined ? { insuranceEnabled: Boolean(input.insuranceEnabled) } : {}),
        ...(input.insuranceSalary !== undefined ? { insuranceSalary: nonNegativeInt(input.insuranceSalary) } : {}),
        ...(input.paidLeaveDaysPerMonth !== undefined ? { paidLeaveDaysPerMonth: Math.min(31, nonNegativeInt(input.paidLeaveDaysPerMonth)) } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
  }

  async deleteWorker(user: JwtUser, id: string) {
    await this.scopedWorker(user, id);
    await this.prisma.workshopWorker.update({
      where: { id },
      data: { active: false },
    });
    return { deleted: true };
  }

  // ---------- Chấm công ----------

  async attendance(user: JwtUser, date?: string) {
    const workDate = this.parseDate(date);
    return this.prisma.workshopAttendance.findMany({
      where: { organizationId: this.organizationId(user), workDate },
      include: { worker: true },
      orderBy: { worker: { name: 'asc' } },
    });
  }

  async workdaySetting(user: JwtUser, date?: string): Promise<WorkshopWorkdaySetting> {
    const organizationId = this.organizationId(user);
    const workDate = this.parseDate(date);
    const setting = await this.prisma.workshopWorkdaySetting.findUnique({
      where: { organizationId_workDate: { organizationId, workDate } },
    });
    return {
      date: dateKey(workDate),
      isHoliday: setting?.isHoliday ?? false,
      label: setting?.label || 'Lễ/Tết',
    };
  }

  async updateWorkdaySetting(user: JwtUser, date: string, input: { isHoliday: boolean; label?: string }) {
    const organizationId = this.organizationId(user);
    const workDate = this.parseDate(date);
    await this.assertMonthOpen(organizationId, workDate);
    const label = input.label?.trim() || 'Lễ/Tết';
    const setting = await this.prisma.workshopWorkdaySetting.upsert({
      where: { organizationId_workDate: { organizationId, workDate } },
      create: { organizationId, workDate, isHoliday: Boolean(input.isHoliday), label },
      update: { isHoliday: Boolean(input.isHoliday), label },
    });
    return {
      date: dateKey(setting.workDate),
      isHoliday: setting.isHoliday,
      label: setting.label,
    } satisfies WorkshopWorkdaySetting;
  }

  /** Chấm trạng thái ngày công (đủ, nửa, phép, không lương, vắng) cho ngày hôm nay hoặc ngày đã qua của tháng chưa chốt. */
  async setDayStatus(user: JwtUser, input: SetWorkshopDayStatusInput) {
    if (typeof input.workerId !== 'string' || !input.workerId.trim()) throw new BadRequestException('Mã nhân sự không hợp lệ.');
    if (!DAY_STATUSES.has(input.status)) throw new BadRequestException('Trạng thái chấm công không hợp lệ.');
    const workDate = parseDateText(String(input.date ?? ''));
    if (dateKey(workDate) > this.today()) throw new BadRequestException('Chưa thể chấm công cho ngày trong tương lai.');
    const organizationId = this.organizationId(user);
    await this.scopedWorker(user, input.workerId);
    await this.assertMonthOpen(organizationId, workDate);
    const worked = input.status === 'PRESENT' || input.status === 'HALF';
    const note = input.note?.trim();
    return this.prisma.workshopAttendance.upsert({
      where: { workerId_workDate: { workerId: input.workerId, workDate } },
      create: { organizationId, workerId: input.workerId, workDate, status: input.status, note: note || '' },
      update: {
        status: input.status,
        ...(worked ? {} : { regularHours: 0, overtimeHours: 0 }),
        ...(note !== undefined ? { note } : {}),
      },
      include: { worker: true },
    });
  }

  /** "Cả đội đủ công": chỉ thêm cho thợ đang làm chưa có bản chấm của ngày đó. */
  async markAllPresent(user: JwtUser, date: string) {
    const workDate = parseDateText(String(date ?? ''));
    if (dateKey(workDate) > this.today()) throw new BadRequestException('Chưa thể chấm công cho ngày trong tương lai.');
    const organizationId = this.organizationId(user);
    await this.assertMonthOpen(organizationId, workDate);
    const [workers, existing] = await Promise.all([
      this.prisma.workshopWorker.findMany({ where: { organizationId, active: true }, select: { id: true } }),
      this.prisma.workshopAttendance.findMany({ where: { organizationId, workDate }, select: { workerId: true } }),
    ]);
    const marked = new Set(existing.map((row) => row.workerId));
    const data = workers
      .filter((worker) => !marked.has(worker.id))
      .map((worker) => ({ organizationId, workerId: worker.id, workDate, status: 'PRESENT', note: '' }));
    if (!data.length) return { created: 0 };
    const result = await this.prisma.workshopAttendance.createMany({ data, skipDuplicates: true });
    return { created: result.count };
  }

  async checkAttendance(
    user: JwtUser,
    input: { workerId: string; action: 'CHECK_IN' | 'CHECK_OUT'; at?: string; overtimeHours?: number; note?: string },
  ) {
    if (typeof input.workerId !== 'string' || !input.workerId.trim()) {
      throw new BadRequestException('Mã nhân sự không hợp lệ.');
    }
    await this.scopedWorker(user, input.workerId);
    if (!['CHECK_IN', 'CHECK_OUT'].includes(input.action)) throw new BadRequestException('Thao tác chấm công không hợp lệ.');
    const at = input.at ? new Date(input.at) : this.now();
    if (Number.isNaN(at.getTime())) throw new BadRequestException('Thời gian chấm công không hợp lệ.');
    if (localDate(at) !== this.today()) {
      throw new BadRequestException('Giờ vào/ra chỉ chấm trong ngày hiện tại. Ngày đã qua thì sửa trạng thái ngày công.');
    }
    const workDate = parseDateText(localDate(at));
    const organizationId = this.organizationId(user);
    await this.assertMonthOpen(organizationId, workDate);
    const existing = await this.prisma.workshopAttendance.findUnique({
      where: { workerId_workDate: { workerId: input.workerId, workDate } },
    });

    if (input.action === 'CHECK_IN') {
      if (existing?.checkInAt) throw new BadRequestException('Nhân sự này đã chấm vào trong ngày.');
      const status = existing?.status === 'HALF' ? 'HALF' : 'PRESENT';
      return this.prisma.workshopAttendance.upsert({
        where: { workerId_workDate: { workerId: input.workerId, workDate } },
        create: {
          organizationId,
          workerId: input.workerId,
          workDate,
          checkInAt: at,
          status,
          note: input.note?.trim() || '',
        },
        update: { checkInAt: at, status, note: input.note?.trim() || existing?.note || '' },
        include: { worker: true },
      });
    }

    if (!existing?.checkInAt) throw new BadRequestException('Cần chấm vào trước khi chấm ra.');
    if (existing.checkOutAt) throw new BadRequestException('Nhân sự này đã chấm ra trong ngày.');
    const elapsedHours = roundHours((at.getTime() - existing.checkInAt.getTime()) / 3_600_000);
    if (elapsedHours < 0) throw new BadRequestException('Giờ chấm ra phải sau giờ chấm vào.');
    const overtimeHours = input.overtimeHours === undefined
      ? roundHours(Math.max(0, elapsedHours - 8))
      : roundHours(Number(input.overtimeHours) || 0);
    return this.prisma.workshopAttendance.update({
      where: { id: existing.id },
      data: {
        checkOutAt: at,
        regularHours: roundHours(Math.min(8, elapsedHours)),
        overtimeHours,
        note: input.note?.trim() || existing.note,
      },
      include: { worker: true },
    });
  }

  async updateAttendance(
    user: JwtUser,
    id: string,
    input: { regularHours?: number; overtimeHours?: number; status?: WorkshopAttendanceStatus; note?: string },
  ) {
    const organizationId = this.organizationId(user);
    const existing = await this.prisma.workshopAttendance.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Không tìm thấy bản chấm công.');
    await this.assertMonthOpen(organizationId, existing.workDate);
    if (input.status && !DAY_STATUSES.has(input.status)) {
      throw new BadRequestException('Trạng thái chấm công không hợp lệ.');
    }
    return this.prisma.workshopAttendance.update({
      where: { id },
      data: {
        ...(input.regularHours !== undefined ? { regularHours: roundHours(Number(input.regularHours) || 0) } : {}),
        ...(input.overtimeHours !== undefined ? { overtimeHours: roundHours(Number(input.overtimeHours) || 0) } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.note !== undefined ? { note: input.note.trim() } : {}),
      },
      include: { worker: true },
    });
  }

  // ---------- Việc khoán ----------

  private toPieceJob(job: Prisma.WorkshopPieceJobGetPayload<{ include: { shares: { include: { worker: true } } } }>): WorkshopPieceJobDto {
    return {
      id: job.id,
      title: job.title,
      projectId: job.projectId,
      projectName: job.projectName,
      workDate: dateKey(job.workDate),
      totalAmount: job.totalAmount,
      note: job.note,
      shares: (job.shares ?? []).map((share) => ({ workerId: share.workerId, workerName: share.worker?.name ?? '', amount: share.amount })),
      createdAt: job.createdAt.toISOString(),
    };
  }

  async pieceJobs(user: JwtUser, month?: string): Promise<WorkshopPieceJobDto[]> {
    const { start, end } = this.parseMonth(month);
    const jobs = await this.prisma.workshopPieceJob.findMany({
      where: { organizationId: this.organizationId(user), workDate: { gte: start, lt: end } },
      include: { shares: { include: { worker: true } } },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    });
    return jobs.map((job) => this.toPieceJob(job));
  }

  async createPieceJob(user: JwtUser, input: CreateWorkshopPieceJobInput): Promise<WorkshopPieceJobDto> {
    const organizationId = this.organizationId(user);
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Vui lòng nhập tên việc khoán.');
    const totalAmount = Math.round(Number(input.totalAmount));
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new BadRequestException('Số tiền khoán phải lớn hơn 0.');
    const workDate = parseDateText(String(input.workDate ?? ''));
    if (dateKey(workDate).slice(0, 7) > this.today().slice(0, 7)) throw new BadRequestException('Không ghi khoán cho tháng chưa tới.');
    await this.assertMonthOpen(organizationId, workDate);

    let shares: Array<{ workerId: string; amount: number }>;
    if (input.shares?.length) {
      shares = input.shares.map((share) => ({ workerId: String(share.workerId), amount: Math.round(Number(share.amount) || 0) }));
      if (shares.some((share) => share.amount < 0)) throw new BadRequestException('Phần chia không được âm.');
      const sum = shares.reduce((total, share) => total + share.amount, 0);
      if (sum !== totalAmount) {
        throw new BadRequestException(`Tổng phần chia (${viNumber(sum)}) phải bằng tổng tiền việc khoán (${viNumber(totalAmount)}).`);
      }
    } else {
      const ids = [...new Set((input.workerIds ?? []).map(String))];
      if (!ids.length) throw new BadRequestException('Chọn ít nhất một thợ nhận việc khoán.');
      const base = Math.floor(totalAmount / ids.length);
      const remainder = totalAmount - base * ids.length;
      shares = ids.map((workerId, index) => ({ workerId, amount: base + (index === 0 ? remainder : 0) }));
    }
    const ids = shares.map((share) => share.workerId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Mỗi thợ chỉ có một phần trong việc khoán.');
    const workers = await this.prisma.workshopWorker.findMany({ where: { id: { in: ids }, organizationId }, select: { id: true } });
    const known = new Set(workers.map((worker) => worker.id));
    if (ids.some((id) => !known.has(id))) throw new BadRequestException('Có thợ không thuộc cơ sở sản xuất này.');

    let projectName = '';
    let projectId: string | null = null;
    if (input.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: input.projectId, organizationId, archivedAt: null },
        select: { id: true, name: true, code: true },
      });
      if (!project) throw new NotFoundException('Không tìm thấy công trình trong cơ sở này.');
      projectId = project.id;
      projectName = project.name || project.code;
    }

    const job = await this.prisma.workshopPieceJob.create({
      data: {
        organizationId,
        title,
        projectId,
        projectName,
        workDate,
        totalAmount,
        note: input.note?.trim() || '',
        createdById: user.sub,
        shares: { create: shares },
      },
      include: { shares: { include: { worker: true } } },
    });
    return this.toPieceJob(job);
  }

  async deletePieceJob(user: JwtUser, id: string) {
    const organizationId = this.organizationId(user);
    const job = await this.prisma.workshopPieceJob.findFirst({ where: { id, organizationId } });
    if (!job) throw new NotFoundException('Không tìm thấy việc khoán.');
    await this.assertMonthOpen(organizationId, job.workDate);
    await this.prisma.workshopPieceJob.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------- Tạm ứng, thưởng, phạt ----------

  private toAdjustment(item: Prisma.WorkshopPayAdjustmentGetPayload<{ include: { worker: true } }>): WorkshopPayAdjustmentDto {
    return {
      id: item.id,
      workerId: item.workerId,
      workerName: item.worker?.name ?? '',
      kind: item.kind as WorkshopPayAdjustmentKind,
      amount: item.amount,
      note: item.note,
      workDate: dateKey(item.workDate),
      createdAt: item.createdAt.toISOString(),
    };
  }

  async adjustments(user: JwtUser, month?: string, workerId?: string): Promise<WorkshopPayAdjustmentDto[]> {
    const { start, end } = this.parseMonth(month);
    const items = await this.prisma.workshopPayAdjustment.findMany({
      where: { organizationId: this.organizationId(user), workDate: { gte: start, lt: end }, ...(workerId ? { workerId } : {}) },
      include: { worker: true },
      orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
    });
    return items.map((item) => this.toAdjustment(item));
  }

  async createAdjustment(user: JwtUser, input: CreateWorkshopPayAdjustmentInput): Promise<WorkshopPayAdjustmentDto> {
    const organizationId = this.organizationId(user);
    if (!ADJUSTMENT_KINDS.has(input.kind)) throw new BadRequestException('Loại khoản không hợp lệ.');
    const amount = Math.round(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Số tiền phải lớn hơn 0.');
    const workDate = parseDateText(String(input.workDate ?? ''));
    if (dateKey(workDate) > this.today()) throw new BadRequestException('Không ghi khoản cho ngày trong tương lai.');
    await this.scopedWorker(user, String(input.workerId));
    await this.assertMonthOpen(organizationId, workDate);
    const item = await this.prisma.workshopPayAdjustment.create({
      data: {
        organizationId,
        workerId: input.workerId,
        kind: input.kind,
        amount,
        note: input.note?.trim() || '',
        workDate,
        createdById: user.sub,
      },
      include: { worker: true },
    });
    return this.toAdjustment(item);
  }

  async deleteAdjustment(user: JwtUser, id: string) {
    const organizationId = this.organizationId(user);
    const item = await this.prisma.workshopPayAdjustment.findFirst({ where: { id, organizationId } });
    if (!item) throw new NotFoundException('Không tìm thấy khoản này.');
    await this.assertMonthOpen(organizationId, item.workDate);
    await this.prisma.workshopPayAdjustment.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------- Lương ----------

  private async payrollData(organizationId: string, start: Date, end: Date, workerId?: string): Promise<PayrollData> {
    const scope = workerId ? { workerId } : {};
    const [attendance, workdaySettings, shares, adjustments] = await Promise.all([
      this.prisma.workshopAttendance.findMany({
        where: { organizationId, workDate: { gte: start, lt: end }, ...scope },
      }),
      this.prisma.workshopWorkdaySetting.findMany({
        where: { organizationId, workDate: { gte: start, lt: end }, isHoliday: true },
      }),
      this.prisma.workshopPieceJobShare.findMany({
        where: { ...scope, job: { organizationId, workDate: { gte: start, lt: end } } },
        include: { job: true },
      }),
      this.prisma.workshopPayAdjustment.findMany({
        where: { organizationId, workDate: { gte: start, lt: end }, ...scope },
      }),
    ]);
    return {
      attendance,
      holidays: workdaySettings.map((setting) => dateKey(setting.workDate)),
      shares,
      adjustments,
    };
  }

  private payslipFor(worker: PrismaWorkshopWorker, data: PayrollData): WorkshopPayslip {
    const days: PayslipDay[] = data.attendance
      .filter((row) => row.workerId === worker.id)
      .map((row) => ({
        date: dateKey(row.workDate),
        status: (DAY_STATUSES.has(row.status as WorkshopAttendanceStatus) ? row.status : 'ABSENT') as PayslipDay['status'],
        regularHours: row.regularHours,
        overtimeHours: row.overtimeHours,
      }));
    const pieces: Array<PayslipPiece & { date: string }> = data.shares
      .filter((share) => share.workerId === worker.id)
      .map((share) => ({ label: share.job.title, projectName: share.job.projectName || undefined, amount: share.amount, date: dateKey(share.job.workDate) }));
    const adjustments: PayslipAdjustment[] = data.adjustments
      .filter((item) => item.workerId === worker.id && ADJUSTMENT_KINDS.has(item.kind as WorkshopPayAdjustmentKind))
      .map((item) => ({ kind: item.kind as PayslipAdjustment['kind'], amount: item.amount, note: item.note, date: dateKey(item.workDate) }));
    const slip = computePayslip({ worker: { ...worker, payType: worker.payType as WorkshopPayType }, days, holidays: data.holidays, pieces, adjustments });
    const line = (item: PayslipAdjustment) => ({ label: ADJUSTMENT_LABEL[item.kind], note: item.note, date: item.date, amount: item.amount });
    return {
      ...slip,
      pieces: slip.pieces.map((piece) => ({ ...piece })),
      bonuses: slip.bonuses.map(line),
      advances: slip.advances.map(line),
      penalties: slip.penalties.map(line),
    };
  }

  private hasActivity(workerId: string, data: PayrollData): boolean {
    return data.attendance.some((row) => row.workerId === workerId)
      || data.shares.some((share) => share.workerId === workerId)
      || data.adjustments.some((item) => item.workerId === workerId);
  }

  private row(worker: PrismaWorkshopWorker, payslip: WorkshopPayslip): WorkshopPayrollRow {
    return { worker: this.toWorker(worker), payslip, daysWorked: payslip.workUnits, estimatedPay: payslip.gross };
  }

  async payroll(user: JwtUser, monthValue?: string): Promise<WorkshopPayrollMonth> {
    const organizationId = this.organizationId(user);
    const { month, start, end } = this.parseMonth(monthValue);
    const [workers, data, close] = await Promise.all([
      this.prisma.workshopWorker.findMany({ where: { organizationId }, orderBy: { name: 'asc' } }),
      this.payrollData(organizationId, start, end),
      this.monthClose(organizationId, month),
    ]);
    const rows = workers
      .filter((worker) => worker.active || this.hasActivity(worker.id, data))
      .map((worker) => this.row(worker, this.payslipFor(worker, data)));
    return {
      month,
      closed: Boolean(close),
      closedAt: close?.closedAt?.toISOString() ?? null,
      rows,
      totals: {
        gross: rows.reduce((sum, row) => sum + row.payslip.gross, 0),
        net: rows.reduce((sum, row) => sum + row.payslip.net, 0),
        advances: rows.reduce((sum, row) => sum + row.payslip.advanceTotal, 0),
        insuranceEmployer: rows.reduce((sum, row) => sum + row.payslip.insuranceEmployer, 0),
        workers: rows.length,
      },
    };
  }

  private basePayFormula(worker: PrismaWorkshopWorker, slip: WorkshopPayslip): string {
    if (worker.payType === 'MONTHLY') {
      return `${viNumber(worker.baseRate)} ÷ ${worker.standardMonthlyDays} × ${viNumber(Math.min(slip.workUnits, worker.standardMonthlyDays))}`;
    }
    if (worker.payType === 'HOURLY') {
      return `${viNumber(worker.baseRate)} × ${viNumber(slip.regularHours + slip.paidLeaveDays * 8)} giờ`;
    }
    return `${viNumber(worker.baseRate)} × ${viNumber(slip.workUnits)} công`;
  }

  async payslip(user: JwtUser, workerId: string, monthValue?: string): Promise<WorkshopPayslipView> {
    const organizationId = this.organizationId(user);
    const worker = await this.scopedWorker(user, workerId);
    const { month, start, end } = this.parseMonth(monthValue);
    const [data, close, organization] = await Promise.all([
      this.payrollData(organizationId, start, end, workerId),
      this.monthClose(organizationId, month),
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    ]);
    const payslip = this.payslipFor(worker, data);
    return {
      month,
      closed: Boolean(close),
      organizationName: organization?.name ?? '',
      worker: this.toWorker(worker),
      payslip,
      basePayFormula: this.basePayFormula(worker, payslip),
    };
  }

  /** Dữ liệu cho PDF phiếu lương, kèm thông tin xưởng in ở đầu phiếu. */
  async payslipPdfData(user: JwtUser, workerId: string, monthValue?: string): Promise<WorkshopPayslipView & { issuer: PdfIssuerProfile | null }> {
    const view = await this.payslip(user, workerId, monthValue);
    const organization = await this.prisma.organization.findUnique({ where: { id: this.organizationId(user) } });
    return {
      ...view,
      issuer: organization ? {
        name: organization.name,
        productionName: organization.productionName || organization.name,
        address: organization.address || '',
        phone: organization.phone || '',
        email: organization.email || '',
        fanpage: organization.fanpage || '',
        mainCategories: organization.mainCategories || '',
        logoUrl: organization.logoUrl || '',
      } : null,
    };
  }

  async closeMonth(user: JwtUser, monthValue: string): Promise<WorkshopPayrollMonth> {
    const organizationId = this.organizationId(user);
    const { month } = monthRange(String(monthValue ?? ''));
    if (month >= this.today().slice(0, 7)) throw new BadRequestException(`Tháng ${monthLabel(month)} chưa kết thúc, chưa thể chốt lương.`);
    if (await this.monthClose(organizationId, month)) throw new BadRequestException(`Tháng ${monthLabel(month)} đã chốt lương.`);
    const payroll = await this.payroll(user, month);
    const close = await this.prisma.workshopPayrollClose.create({
      data: { organizationId, month, totalNet: payroll.totals.net, closedById: user.sub },
    });
    return { ...payroll, closed: true, closedAt: close.closedAt.toISOString() };
  }

  async reopenMonth(user: JwtUser, monthValue: string) {
    const organizationId = this.organizationId(user);
    const { month } = monthRange(String(monthValue ?? ''));
    const close = await this.monthClose(organizationId, month);
    if (!close) throw new BadRequestException(`Tháng ${monthLabel(month)} chưa chốt lương.`);
    await this.prisma.workshopPayrollClose.delete({ where: { organizationId_month: { organizationId, month } } });
    return this.payroll(user, month);
  }

  // ---------- Nhắc việc ----------

  async reminders(user: JwtUser, includeCompleted = false) {
    return this.prisma.workshopReminder.findMany({
      where: {
        organizationId: this.organizationId(user),
        ...(includeCompleted ? {} : { completedAt: null }),
      },
      orderBy: [{ completedAt: 'asc' }, { dueAt: 'asc' }],
      take: 100,
    });
  }

  async createReminder(user: JwtUser, input: CreateWorkshopReminderInput) {
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Vui lòng nhập nội dung nhắc việc.');
    const dueAt = new Date(input.dueAt);
    if (Number.isNaN(dueAt.getTime())) throw new BadRequestException('Thời hạn nhắc việc không hợp lệ.');
    const priority = input.priority ?? 'NORMAL';
    if (!['LOW', 'NORMAL', 'HIGH'].includes(priority)) throw new BadRequestException('Mức ưu tiên không hợp lệ.');
    return this.prisma.workshopReminder.create({
      data: {
        organizationId: this.organizationId(user),
        createdById: user.sub,
        title,
        dueAt,
        priority,
        note: input.note?.trim() || '',
      },
    });
  }

  async updateReminder(
    user: JwtUser,
    id: string,
    input: Partial<CreateWorkshopReminderInput> & { completed?: boolean },
  ) {
    const existing = await this.prisma.workshopReminder.findFirst({
      where: { id, organizationId: this.organizationId(user) },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy nhắc việc.');
    const dueAt = input.dueAt === undefined ? undefined : new Date(input.dueAt);
    if (dueAt && Number.isNaN(dueAt.getTime())) throw new BadRequestException('Thời hạn nhắc việc không hợp lệ.');
    if (input.priority && !['LOW', 'NORMAL', 'HIGH'].includes(input.priority)) {
      throw new BadRequestException('Mức ưu tiên không hợp lệ.');
    }
    return this.prisma.workshopReminder.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(dueAt ? { dueAt } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.note !== undefined ? { note: input.note.trim() } : {}),
        ...(input.completed !== undefined ? { completedAt: input.completed ? this.now() : null } : {}),
      },
    });
  }

  async deleteReminder(user: JwtUser, id: string) {
    const existing = await this.prisma.workshopReminder.findFirst({
      where: { id, organizationId: this.organizationId(user) },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy nhắc việc.');
    await this.prisma.workshopReminder.delete({ where: { id } });
    return { success: true };
  }

  async dashboard(user: JwtUser, date?: string, month?: string): Promise<WorkforceDashboard> {
    const organizationId = this.organizationId(user);
    const workDate = this.parseDate(date);
    const dateText = dateKey(workDate);
    const monthText = month || dateText.slice(0, 7);
    const [workers, attendance, payroll, reminders] = await Promise.all([
      this.prisma.workshopWorker.findMany({ where: { organizationId, active: true } }),
      this.prisma.workshopAttendance.findMany({
        where: { organizationId, workDate },
        include: { worker: true },
        orderBy: { worker: { name: 'asc' } },
      }),
      this.payroll(user, monthText),
      this.prisma.workshopReminder.findMany({
        where: { organizationId, completedAt: null },
        orderBy: { dueAt: 'asc' },
        take: 5,
      }),
    ]);
    return {
      date: dateText,
      month: monthText,
      workerCount: workers.length,
      presentCount: attendance.filter((row) => row.status === 'PRESENT' || row.status === 'HALF').length,
      checkedInCount: attendance.filter((row) => row.checkInAt && !row.checkOutAt).length,
      overtimeHours: roundHours(attendance.reduce((sum, row) => sum + row.overtimeHours, 0)),
      estimatedPayroll: payroll.totals.gross,
      monthClosed: payroll.closed,
      reminders: reminders.map((reminder) => this.toReminder(reminder)),
      attendance: attendance.map((row) => this.toAttendance(row)),
    };
  }
}
