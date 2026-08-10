import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WarrantyService } from './warranty.service';
import type { ActivateWarrantyInput } from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';

@Controller('warranties')
export class WarrantyController {
  constructor(private readonly service: WarrantyService) {}

  @Post('activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
  activateWarranty(@Body() body: ActivateWarrantyInput, @CurrentUser() user: JwtUser) {
    return this.service.activateWarranty(body, user.sub);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
  listWarranties(@CurrentUser() user: JwtUser) {
    const activatedById = (user.role === 'DAILY' || user.role === 'FACTORY') ? user.sub : undefined;
    return this.service.listWarranties({ activatedById });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
  getWarranty(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.getWarranty(id, user);
  }
}
