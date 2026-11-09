import { IsString, Length } from 'class-validator';

export class VerificationConfirmDto {
  @IsString()
  pendingVerificationId!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class VerificationResendDto {
  @IsString()
  pendingVerificationId!: string;
}
