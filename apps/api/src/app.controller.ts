import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { EurohouseService } from './eurohouse/eurohouse.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { Roles } from './auth/roles.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly eurohouse: EurohouseService,
  ) {}

  @Get('health')
  health() {
    return this.appService.health();
  }

  @Get('quotes/sample')
  sampleQuote() {
    return this.appService.sampleQuote();
  }

  @Get('admin/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async adminDashboard() {
    const orders = await this.eurohouse.listOrders();
    return this.appService.adminDashboard(orders);
  }

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  adminOrders() {
    return this.eurohouse.listOrders();
  }
}
