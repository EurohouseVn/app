import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { ManufacturingService } from './manufacturing.service';

@Controller('manufacturing/v2')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class ManufacturingController {
  constructor(private readonly service: ManufacturingService) {}

  @Get('feature-flags')
  flags() { return this.service.flags(); }

  @Post('preview')
  preview(@Body() body: Parameters<ManufacturingService['preview']>[0]) {
    return this.service.preview(body);
  }
}
