import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu để xác nhận.' })
  password!: string;
}
