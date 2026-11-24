import { IsString, MinLength } from 'class-validator';

export class RegisterWorkshopPhoneDto {
  @IsString()
  @MinLength(2)
  organizationName!: string;

  @IsString()
  @MinLength(3)
  address!: string;

  @IsString()
  @MinLength(9)
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
