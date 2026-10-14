import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateWorkshopReminderInput,
  CreateWorkshopWorkerInput,
  WorkforceDashboard,
  WorkshopAttendance as WorkshopAttendanceDto,
  WorkshopPayrollRow,
  WorkshopPayType,
  WorkshopReminder as WorkshopReminderDto,
  WorkshopWorker as WorkshopWorkerDto,
} from '@eurohouse/types';
import type { Prisma, WorkshopReminder as PrismaWorkshopReminder, WorkshopWorker as PrismaWorkshopWorker } from '@prisma/client';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const PAY_TYPES = new Set<WorkshopPayType>(['DAILY', 'HOURLY', 'MONTHLY']);

function localDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function parseDate(value?: string): Date {
  const normalized = value?.trim() || localDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new BadRequestException('Ngày phải có định dạng YYYY-MM-DD.');
  }
  return new Date(`${normalized}T00:00:00.000Z`);
}

function parseMonth(value?: string): { month: string; start: Date; end: Date } {
  const month = value?.trim() || localDate().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Tháng phải có định dạng YYYY-MM.');
  const [year, monthNumber] = month.split('-').map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new BadRequestException('Tháng không hợp lệ.');
  return {
    month,
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

function roundHours(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

@Injectable()
export class WorkforceService {
  constructor(private readonly prisma: PrismaService) {}

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
    const baseRate = Math.max(0, Math.round(Number(input.baseRate) || 0));
    return this.prisma.workshopWorker.create({
      data: {
        organizationId: this.organizationId(user),
        name,
        phone: input.phone?.trim() || '',
        roleName: input.roleName?.trim() || 'Thợ sản xuất',
        payType: input.payType,
        baseRate,
        overtimeRate: Math.max(0, Math.round(Number(input.overtimeRate) || 0)),
        standardMonthlyDays: Math.min(31, Math.max(1, Math.round(Number(input.standardMonthlyDays) || 26))),
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
        ...(input.baseRate !== undefined ? { baseRate: Math.max(0, Math.round(Number(input.baseRate) || 0)) } : {}),
        ...(input.overtimeRate !== undefined ? { overtimeRate: Math.max(0, Math.round(Number(input.overtimeRate) || 0)) } : {}),
        ...(input.standardMonthlyDays !== undefined
          ? { standardMonthlyDays: Math.min(31, Math.max(1, Math.round(Number(input.standardMonthlyDays) || 26))) }
          : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
  }

  async attendance(user: JwtUser, date?: string) {
    const workDate = parseDate(date);
    return this.prisma.workshopAttendance.findMany({
      where: { organizationId: this.organizationId(user), workDate },
      include: { worker: true },
      orderBy: { worker: { name: 'asc' } },
    });
  }

  async checkAttendance(
    user: JwtUser,
    input: { workerId: string; action: 'CHECK_IN' | 'CHECK_OUT'; at?: string; overtimeHours?: number; note?: string },
  ) {
    await this.scopedWorker(user, input.workerId);
    if (!['CHECK_IN', 'CHECK_OUT'].includes(input.action)) throw new BadRequestException('Thao tác chấm công không hợp lệ.');
    const at = input.at ? new Date(input.at) : new Date();
    if (Number.isNaN(at.getTime())) throw new BadRequestException('Thời gian chấm công không hợp lệ.');
    const workDate = parseDate(localDate(at));
    const organizationId = this.organizationId(user);
    const existing = await this.prisma.workshopAttendance.findUnique({
      where: { workerId_workDate: { workerId: input.workerId, workDate } },
    });

    if (input.action === 'CHECK_IN') {
      if (existing?.checkInAt) throw new BadRequestException('Nhân sự này đã chấm vào trong ngày.');
      return this.prisma.workshopAttendance.upsert({
        where: { workerId_workDate: { workerId: input.workerId, workDate } },
        create: {
          organizationId,
          workerId: input.workerId,
          workDate,
          checkInAt: at,
          status: 'PRESENT',
          note: input.note?.trim() || '',
        },
        update: { checkInAt: at, status: 'PRESENT', note: input.note?.trim() || existing?.note || '' },
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
        status: 'PRESENT',
        note: input.note?.trim() || existing.note,
      },
      include: { worker: true },
    });
  }

  async updateAttendance(
    user: JwtUser,
    id: string,
    input: { regularHours?: number; overtimeHours?: number; status?: 'PRESENT' | 'ABSENT' | 'LEAVE'; note?: string },
  ) {
    const existing = await this.prisma.workshopAttendance.findFirst({
      where: { id, organizationId: this.organizationId(user) },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy bản chấm công.');
    if (input.status && !['PRESENT', 'ABSENT', 'LEAVE'].includes(input.status)) {
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

  private hourlyOvertimeRate(worker: PrismaWorkshopWorker): number {
    if (worker.overtimeRate > 0) return worker.overtimeRate;
    if (worker.payType === 'HOURLY') return worker.baseRate * 1.5;
    if (worker.payType === 'MONTHLY') return (worker.baseRate / worker.standardMonthlyDays / 8) * 1.5;
    return (worker.baseRate / 8) * 1.5;
  }

  async payroll(user: JwtUser, monthValue?: string): Promise<WorkshopPayrollRow[]> {
    const organizationId = this.organizationId(user);
    const { start, end } = parseMonth(monthValue);
    const workers = await this.prisma.workshopWorker.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
    const attendance = await this.prisma.workshopAttendance.findMany({
      where: { organizationId, workDate: { gte: start, lt: end } },
    });
    return workers.map((worker) => {
      const rows = attendance.filter((row) => row.workerId === worker.id && row.status === 'PRESENT');
      const daysWorked = rows.filter((row) => row.checkInAt || row.regularHours > 0).length;
      const regularHours = roundHours(rows.reduce((sum, row) => sum + row.regularHours, 0));
      const overtimeHours = roundHours(rows.reduce((sum, row) => sum + row.overtimeHours, 0));
      let basePay = 0;
      if (worker.payType === 'HOURLY') basePay = regularHours * worker.baseRate;
      if (worker.payType === 'DAILY') basePay = daysWorked * worker.baseRate;
      if (worker.payType === 'MONTHLY') basePay = worker.baseRate * Math.min(1, daysWorked / worker.standardMonthlyDays);
      const overtimePay = overtimeHours * this.hourlyOvertimeRate(worker);
      return {
        worker: this.toWorker(worker),
        daysWorked,
        regularHours,
        overtimeHours,
        basePay: Math.round(basePay),
        overtimePay: Math.round(overtimePay),
        estimatedPay: Math.round(basePay + overtimePay),
      };
    });
  }

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
        ...(input.completed !== undefined ? { completedAt: input.completed ? new Date() : null } : {}),
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
    const workDate = parseDate(date);
    const dateText = workDate.toISOString().slice(0, 10);
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
      presentCount: attendance.filter((row) => row.status === 'PRESENT').length,
      checkedInCount: attendance.filter((row) => row.checkInAt && !row.checkOutAt).length,
      overtimeHours: roundHours(attendance.reduce((sum, row) => sum + row.overtimeHours, 0)),
      estimatedPayroll: payroll.reduce((sum, row) => sum + row.estimatedPay, 0),
      reminders: reminders.map((reminder) => this.toReminder(reminder)),
      attendance: attendance.map((row) => this.toAttendance(row)),
    };
  }
}
