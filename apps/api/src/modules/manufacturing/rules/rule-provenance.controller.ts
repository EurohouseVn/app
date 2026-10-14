import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { TechnicalReviewState } from '@prisma/client';
import { CurrentUser, type JwtUser } from '../../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { Roles } from '../../../auth/roles.decorator';
import { RolesGuard } from '../../../auth/roles.guard';
import { assertManufacturingFeatureEnabled } from '../feature-flags';
import { RuleProvenanceService } from './rule-provenance.service';

@Controller('manufacturing/v2/rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class RuleProvenanceController {
  constructor(private readonly rules: RuleProvenanceService) {}

  @Get()
  list(@CurrentUser() user: JwtUser | undefined, @Query('datasetRevisionId') datasetRevisionId?: string) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.rules.list(user, datasetRevisionId);
  }

  @Get('evidence-matrix')
  matrix(@CurrentUser() user: JwtUser | undefined, @Query('datasetRevisionId') datasetRevisionId?: string) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.rules.evidenceMatrix(user, datasetRevisionId);
  }

  @Post()
  create(@CurrentUser() user: JwtUser | undefined, @Body() body: Parameters<RuleProvenanceService['create']>[1]) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.rules.create(user, body);
  }

  @Patch(':id/review')
  review(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { state: TechnicalReviewState; notes: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.rules.review(user, id, body);
  }
}
