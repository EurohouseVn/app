import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { EUROHOUSE_FEATURE_KEYS, type EurohouseFeatureKey } from '@eurohouse/types';

export class RedeemEurohouseInviteDto {
  @IsString()
  @MinLength(8)
  code!: string;
}

export class CreateEurohouseInviteDto {
  @IsString()
  targetOrganizationId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(EUROHOUSE_FEATURE_KEYS, { each: true })
  featureKeys!: EurohouseFeatureKey[];
}

export class FeatureMutationDto {
  @IsIn(EUROHOUSE_FEATURE_KEYS)
  featureKey!: EurohouseFeatureKey;
}

export class RevokeFeatureDto extends FeatureMutationDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class AdminActivateFeatureDto extends FeatureMutationDto {
  @IsString()
  @IsOptional()
  nppOrganizationId?: string;
}

export class TransferEurohouseNppDto {
  @IsString()
  nextNppOrganizationId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}

export class RevokeEurohouseInviteDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
