import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập email hoặc số điện thoại.' })
  identifier!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu.' })
  password!: string;

  /** Khi đã đủ máy cùng loại: id phiên cần đăng xuất để nhường chỗ cho máy này. */
  @IsOptional()
  @IsString()
  revokeSessionId?: string;
}
