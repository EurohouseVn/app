import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { WebsiteReviewDecision, WebsiteReviewStage } from '@eurohouse/types';

const REVIEW_STAGES = ['TECHNICAL', 'MARKETING'] as const;
const REVIEW_DECISIONS = ['APPROVED', 'CHANGES_REQUESTED'] as const;

export class ReviewWebsiteRevisionDto {
  @IsIn(REVIEW_STAGES)
  stage!: WebsiteReviewStage;

  @IsIn(REVIEW_DECISIONS)
  decision!: WebsiteReviewDecision;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
