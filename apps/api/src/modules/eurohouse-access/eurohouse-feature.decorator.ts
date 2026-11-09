import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import type { EurohouseFeatureKey } from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EurohouseFeatureGuard } from './eurohouse-feature.guard';

export const EUROHOUSE_FEATURE_REQUIRED_KEY = 'eurohouseFeatureRequired';

export const RequiresEurohouseFeature = (featureKey: EurohouseFeatureKey) =>
  applyDecorators(
    SetMetadata(EUROHOUSE_FEATURE_REQUIRED_KEY, featureKey),
    UseGuards(JwtAuthGuard, EurohouseFeatureGuard),
  );
