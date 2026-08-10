import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import type {
  CreateCashTransactionInput,
  DebtItem,
  PayDebtInput,
} from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';

@Controller()
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('debts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
  listDebts(
    @Query('direction') direction?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('nppOrgId') nppOrgId?: string,
    @CurrentUser() user?: JwtUser,
  ) {
    if (user?.role === 'FACTORY' || user?.role === 'DAILY') return this.service.listUserDebts(user);
    return this.service.listDebts({ direction, status, type, nppOrgId, excludeNppInternal: true });
  }

  @Post('debts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  createDebt(@Body() body: Partial<DebtItem> & { projectId?: string }) {
    return this.service.createDebt(body);
  }

  @Patch('debts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updateDebt(@Param('id') id: string, @Body() body: Partial<DebtItem>) {
    return this.service.updateDebt(id, body);
  }

  @Post('debts/:id/pay')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  payDebt(@Param('id') id: string, @Body() body: PayDebtInput, @CurrentUser() user: JwtUser) {
    return this.service.payDebt(id, body, user.sub);
  }

  @Post('debts/:id/payment-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FACTORY', 'DAILY')
  createDebtPaymentRequest(@Param('id') id: string, @Body() body: PayDebtInput, @CurrentUser() user: JwtUser) {
    return this.service.createDebtPaymentRequest(id, body, user);
  }

  @Get('npp/debts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppDebts(@CurrentUser() user: JwtUser) {
    return this.service.listDebts({ nppOrgId: user.organizationId! });
  }

  @Post('npp/debts/:id/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  payNppDebt(@Param('id') id: string, @Body() body: PayDebtInput, @CurrentUser() user: JwtUser) {
    return this.service.payNppDebt(id, body, user.organizationId!, user.sub);
  }

  @Get('npp/debts/payment-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppDebtPaymentRequests(@CurrentUser() user: JwtUser) {
    return this.service.listNppDebtPaymentRequests(user.organizationId!);
  }

  @Post('npp/debts/payment-requests/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  confirmNppDebtPaymentRequest(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.confirmNppDebtPaymentRequest(id, user.organizationId!, user.sub);
  }

  @Get('cash-transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  listCashTransactions(
    @Query('type') type?: string,
    @Query('debtId') debtId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listCashTransactions({ type, debtId, from, to });
  }

  @Post('cash-transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  createCashTransaction(@Body() body: CreateCashTransactionInput, @CurrentUser() user: JwtUser) {
    return this.service.createCashTransaction(body, user.sub);
  }

  @Get('reports/monthly-pnl')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  monthlyPnl() {
    return this.service.monthlyPnL(6);
  }
}
