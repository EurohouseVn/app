import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { CurrentUser, type JwtUser } from './current-user.decorator';
import { DeviceSessionService } from './device-session.service';

/** Thiết bị đang đăng nhập của NPP: xem danh sách và đăng xuất từ xa một máy. */
@Controller('npp/devices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('NPP')
export class NppDevicesController {
  constructor(private readonly sessions: DeviceSessionService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.sessions.listActive(user.organizationId!, user.sid);
  }

  @Delete(':id')
  async revoke(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    await this.sessions.revoke(user.organizationId!, id);
    return { ok: true };
  }
}
