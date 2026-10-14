import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { CreateWorkshopReminderInput, CreateWorkshopWorkerInput } from '@eurohouse/types';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { WorkforceService } from './workforce.service';

@Controller('workforce')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FACTORY', 'DAILY')
export class WorkforceController {
  constructor(private readonly service: WorkforceService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtUser, @Query('date') date?: string, @Query('month') month?: string) {
    return this.service.dashboard(user, date, month);
  }

  @Get('workers')
  workers(@CurrentUser() user: JwtUser, @Query('includeInactive') includeInactive?: string) {
    return this.service.workers(user, includeInactive === 'true');
  }

  @Post('workers')
  createWorker(@CurrentUser() user: JwtUser, @Body() body: CreateWorkshopWorkerInput) {
    return this.service.createWorker(user, body);
  }

  @Patch('workers/:id')
  updateWorker(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Partial<CreateWorkshopWorkerInput> & { active?: boolean }) {
    return this.service.updateWorker(user, id, body);
  }

  @Get('attendance')
  attendance(@CurrentUser() user: JwtUser, @Query('date') date?: string) {
    return this.service.attendance(user, date);
  }

  @Post('attendance/check')
  checkAttendance(
    @CurrentUser() user: JwtUser,
    @Body() body: { workerId: string; action: 'CHECK_IN' | 'CHECK_OUT'; at?: string; overtimeHours?: number; note?: string },
  ) {
    return this.service.checkAttendance(user, body);
  }

  @Patch('attendance/:id')
  updateAttendance(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { regularHours?: number; overtimeHours?: number; status?: 'PRESENT' | 'ABSENT' | 'LEAVE'; note?: string },
  ) {
    return this.service.updateAttendance(user, id, body);
  }

  @Get('payroll')
  payroll(@CurrentUser() user: JwtUser, @Query('month') month?: string) {
    return this.service.payroll(user, month);
  }

  @Get('reminders')
  reminders(@CurrentUser() user: JwtUser, @Query('includeCompleted') includeCompleted?: string) {
    return this.service.reminders(user, includeCompleted === 'true');
  }

  @Post('reminders')
  createReminder(@CurrentUser() user: JwtUser, @Body() body: CreateWorkshopReminderInput) {
    return this.service.createReminder(user, body);
  }

  @Patch('reminders/:id')
  updateReminder(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: Partial<CreateWorkshopReminderInput> & { completed?: boolean },
  ) {
    return this.service.updateReminder(user, id, body);
  }

  @Delete('reminders/:id')
  deleteReminder(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteReminder(user, id);
  }
}
