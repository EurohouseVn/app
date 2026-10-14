import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { TechnicalReviewState } from '@prisma/client';
import { CurrentUser, type JwtUser } from '../../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { Roles } from '../../../auth/roles.decorator';
import { RolesGuard } from '../../../auth/roles.guard';
import { assertManufacturingFeatureEnabled } from '../feature-flags';
import { TechnicalSourceService } from './technical-source.service';

@Controller('manufacturing/v2/technical-sources')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TechnicalSourceController {
  constructor(private readonly sources: TechnicalSourceService) {}

  @Get()
  list(@CurrentUser() user: JwtUser | undefined, @Query('datasetRevisionId') revisionId?: string) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.sources.list(user, revisionId);
  }

  @Post()
  create(@CurrentUser() user: JwtUser | undefined, @Body() body: Parameters<TechnicalSourceService['create']>[1]) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.sources.create(user, body);
  }

  @Patch(':id/review')
  review(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { state: TechnicalReviewState; notes: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.sources.review(user, id, body);
  }

  @Post(':id/links')
  link(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: Parameters<TechnicalSourceService['link']>[2]) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.sources.link(user, id, body);
  }
}
