import { IsDateString, IsObject } from 'class-validator';
import type { HomepagePayloadV1, HomepageSaveInput, HomepageSeoInput } from '@eurohouse/types';

export class SaveHomepageDto implements HomepageSaveInput {
  @IsObject()
  payload!: HomepagePayloadV1;

  @IsDateString()
  expectedUpdatedAt!: string;

  @IsObject()
  seo!: HomepageSeoInput;

  @IsObject()
  mediaByRole!: HomepageSaveInput['mediaByRole'];
}
