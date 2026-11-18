import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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

  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  province?: string;

}
