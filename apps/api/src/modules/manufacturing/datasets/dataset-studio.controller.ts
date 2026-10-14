import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtUser } from '../../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { Roles } from '../../../auth/roles.decorator';
import { RolesGuard } from '../../../auth/roles.guard';
import { assertManufacturingFeatureEnabled } from '../feature-flags';
import { DatasetCoverageService } from './dataset-coverage.service';
import { DatasetStudioService, type DatasetImportInput } from './dataset-studio.service';

@Controller('manufacturing/v2/dataset-studio')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DatasetStudioController {
  constructor(private readonly studio: DatasetStudioService, private readonly coverage: DatasetCoverageService) {}

  @Get('datasets')
  list(@CurrentUser() user?: JwtUser) { assertManufacturingFeatureEnabled('datasetStudio'); return this.studio.listDatasets(user); }

  @Post('datasets')
  create(@CurrentUser() user: JwtUser | undefined, @Body() body: Parameters<DatasetStudioService['createDataset']>[1]) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.studio.createDataset(user, body);
  }

  @Post('datasets/:id/revisions')
  createRevision(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { versionTag: string; fromRevisionId?: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.studio.createRevision(user, id, body);
  }

  @Get('revisions/:id')
  revision(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string) { assertManufacturingFeatureEnabled('datasetStudio'); return this.studio.getRevision(user, id); }

  @Patch('revisions/:id/import')
  import(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: DatasetImportInput) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.studio.importRevision(user, id, body);
  }

  @Post('revisions/:id/validate')
  validate(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string) { assertManufacturingFeatureEnabled('datasetStudio'); return this.studio.validateRevision(user, id); }

  @Post('revisions/:id/coverage')
  calculateCoverage(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.coverage.calculate(user, id);
  }

  @Post('revisions/:id/submit-review')
  submitReview(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { notes?: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.studio.submitReview(user, id, body.notes ?? '');
  }

  @Post('revisions/:id/review')
  review(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { notes: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.studio.recordReview(user, id, body);
  }

  @Post('revisions/:id/release')
  release(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { notes?: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.studio.release(user, id, body.notes ?? '');
  }

  @Post('revisions/:id/retire')
  retire(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { notes?: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.studio.retire(user, id, body.notes ?? '');
  }
}
