import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { WebsiteContentKind, WebsiteProductFamily } from '@eurohouse/types';

const CONTENT_KINDS = [
  'PRODUCT',
  'INDUSTRIAL_SERVICE',
  'SOLUTION',
  'CASE_STUDY',
  'PAGE',
  'ARTICLE',
  'FAQ',
  'VIDEO',
] as const;
const PRODUCT_FAMILIES = ['RESIDENTIAL', 'INDUSTRIAL'] as const;

export function normalizeWebsiteSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class WebsiteSeoInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(320)
  description!: string;

  @IsString()
  @MaxLength(240)
  @Matches(/^\/(?!\/)[^?#]*$/, {
    message: 'canonicalPath must be a relative site path beginning with one slash',
  })
  canonicalPath!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  schemaType!: string;
}

export class CreateWebsiteContentDto {
  @IsIn(CONTENT_KINDS)
  kind!: WebsiteContentKind;

  @IsOptional()
  @IsIn(PRODUCT_FAMILIES)
  family?: WebsiteProductFamily;

  @Transform(({ value }) => normalizeWebsiteSlug(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsString()
  @Matches(/^[a-z]{2}(?:-[a-z]{2})?$/)
  locale: string = 'vi';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  aluSystemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  operationalProjectId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  eyebrow?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary!: string;

  @IsObject()
  body!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  sourceRefs?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsBoolean()
  hasHighRiskClaims: boolean = false;

  @ValidateNested()
  @Type(() => WebsiteSeoInputDto)
  seo!: WebsiteSeoInputDto;
}
