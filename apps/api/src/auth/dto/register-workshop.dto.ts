import { IsEmail, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class RegisterWorkshopDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(2)
  organizationName!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @ValidateIf((value) => Boolean(value.email))
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsIn(['EMAIL', 'PHONE'])
  @IsOptional()
  verificationChannel?: 'EMAIL' | 'PHONE';
}
