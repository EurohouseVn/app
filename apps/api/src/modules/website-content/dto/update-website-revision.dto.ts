import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { WebsiteSeoInputDto } from './create-website-content.dto';

export class UpdateWebsiteRevisionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  eyebrow?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  sourceRefs?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsBoolean()
  hasHighRiskClaims?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => WebsiteSeoInputDto)
  seo?: WebsiteSeoInputDto;
}
