import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { EurohouseService } from './eurohouse/eurohouse.service';

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

  @Post('auth/demo-login')
  demoLogin(@Body() body: { identifier?: string; password?: string }) {
    return this.appService.demoLogin(body.identifier ?? 'board@eurohouse.vn', body.password ?? 'Eurohouse@2026');
  }

  @Get('admin/dashboard')
  async adminDashboard() {
    const orders = await this.eurohouse.listOrders();
    return this.appService.adminDashboard(orders);
  }

  @Get('admin/orders')
  adminOrders() {
    return this.eurohouse.listOrders();
  }
}
