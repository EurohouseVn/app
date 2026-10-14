import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtUser } from '../../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { Roles } from '../../../auth/roles.decorator';
import { RolesGuard } from '../../../auth/roles.guard';
import { BomService } from '../bom/bom.service';
import { ComparisonService } from '../comparison/comparison.service';
import { assertManufacturingFeatureEnabled } from '../feature-flags';
import { ExpectedOutputService } from './expected-output.service';
import { GoldenFixtureService } from './golden-fixture.service';

@Controller('manufacturing/v2/verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class VerificationController {
  constructor(
    private readonly fixtures: GoldenFixtureService,
    private readonly comparisons: ComparisonService,
    private readonly boms: BomService,
    private readonly expectedOutputs: ExpectedOutputService,
  ) {}

  @Get('fixtures')
  listFixtures(@CurrentUser() user: JwtUser | undefined) { assertManufacturingFeatureEnabled('datasetStudio'); return this.fixtures.list(user); }

  @Post('fixtures/bootstrap-candidates')
  bootstrap(@CurrentUser() user: JwtUser | undefined) { assertManufacturingFeatureEnabled('datasetStudio'); return this.fixtures.bootstrapCandidates(user); }

  @Get('fixtures/regression-manifest')
  regressionManifest(@CurrentUser() user: JwtUser | undefined) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.fixtures.regressionManifest(user);
  }

  @Post('fixtures')
  createFixture(@CurrentUser() user: JwtUser | undefined, @Body() body: Parameters<GoldenFixtureService['create']>[1]) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.fixtures.create(user, body);
  }

  @Post('fixtures/:id/calculate')
  calculate(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string) { assertManufacturingFeatureEnabled('datasetStudio'); return this.fixtures.calculate(user, id); }

  @Get('fixtures/:id/expected-output-revisions')
  expectedOutputRevisions(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.expectedOutputs.list(user, id);
  }

  @Post('fixtures/:id/expected-output-revisions')
  createExpectedOutput(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: Parameters<ExpectedOutputService['create']>[2]) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.expectedOutputs.create(user, id, body);
  }

  @Post('expected-output-revisions/:id/submit-review')
  submitExpectedOutput(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { notes: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.expectedOutputs.submitReview(user, id, body.notes);
  }

  @Post('expected-output-revisions/:id/approve')
  approveExpectedOutput(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { notes: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.expectedOutputs.approve(user, id, body.notes);
  }

  @Post('fixtures/:id/submit-review')
  submitReview(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { reviewChecks: Record<string, boolean>; notes: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.fixtures.submitReview(user, id, body);
  }

  @Post('fixtures/:id/approve')
  approve(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { notes: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.fixtures.approve(user, id, body);
  }

  @Post('fixtures/:id/reject')
  reject(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string, @Body() body: { reason: string }) {
    assertManufacturingFeatureEnabled('datasetStudio');
    return this.fixtures.reject(user, id, body);
  }

  @Get('comparisons')
  listComparisons(@CurrentUser() user: JwtUser | undefined) { assertManufacturingFeatureEnabled('shadowMode'); return this.comparisons.list(user); }

  @Post('comparisons')
  compare(@CurrentUser() user: JwtUser, @Body() body: Omit<Parameters<ComparisonService['compare']>[0], 'createdById'>) {
    assertManufacturingFeatureEnabled('shadowMode');
    return this.comparisons.compare({ ...body, createdById: user.sub });
  }

  @Post('comparisons/technical-truth')
  compareTechnicalTruth(@CurrentUser() user: JwtUser | undefined, @Body() body: Parameters<ComparisonService['compareTechnicalTruth']>[1]) {
    assertManufacturingFeatureEnabled('shadowMode');
    return this.comparisons.compareTechnicalTruth(user, body);
  }

  @Patch('differences/:id/review')
  reviewDifference(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: Parameters<ComparisonService['reviewDifference']>[2],
  ) {
    assertManufacturingFeatureEnabled('shadowMode');
    return this.comparisons.reviewDifference(id, user, body);
  }

  @Patch('differences/:id/resolve-technical')
  resolveTechnicalDifference(
    @CurrentUser() user: JwtUser | undefined,
    @Param('id') id: string,
    @Body() body: Parameters<ComparisonService['resolveTechnicalDifference']>[2],
  ) {
    assertManufacturingFeatureEnabled('shadowMode');
    return this.comparisons.resolveTechnicalDifference(id, user, body);
  }

  @Post('boms/:id/calculated')
  markBomCalculated(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: { notes?: string }) {
    assertManufacturingFeatureEnabled('bomReview');
    return this.boms.markCalculated(id, user.sub, body.notes ?? '');
  }

  @Post('boms/:id/submit-review')
  submitBomReview(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: { notes: string }) {
    assertManufacturingFeatureEnabled('bomReview');
    return this.boms.submitTechnicalReview(id, user.sub, body.notes);
  }

  @Post('boms/:id/approve')
  approveBom(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: { notes: string }) {
    assertManufacturingFeatureEnabled('bomReview');
    return this.boms.approve(id, user.sub, body.notes);
  }

  @Post('boms/:id/release')
  releaseBom(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: { notes?: string }) {
    assertManufacturingFeatureEnabled('bomReview');
    return this.boms.releaseReviewed(id, user.sub, body.notes ?? '');
  }
}
