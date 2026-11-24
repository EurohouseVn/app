import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import type { RegisterFactoryInput } from '@eurohouse/types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, type JwtUser } from './current-user.decorator';
import { RegisterWorkshopDto } from './dto/register-workshop.dto';
import { RegisterWorkshopPhoneDto } from './dto/register-workshop-phone.dto';
import { VerificationConfirmDto, VerificationResendDto } from './dto/verification.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.identifier, body.password);
  }

  @Post('register-factory')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  registerFactory(@Body() body: RegisterFactoryInput) {
    return this.authService.registerFactory(body);
  }

  @Post('register-workshop')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  registerWorkshop(@Body() body: RegisterWorkshopDto) {
    return this.authService.registerWorkshop(body);
  }

  @Post('register-workshop-phone')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  registerWorkshopByPhone(@Body() body: RegisterWorkshopPhoneDto) {
    return this.authService.registerWorkshopByPhone(body);
  }

  @Post('verification/confirm')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirmVerification(@Body() body: VerificationConfirmDto) {
    return this.authService.confirmWorkshopVerification(body);
  }

  @Post('verification/resend')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  resendVerification(@Body() body: VerificationResendDto) {
    return this.authService.resendWorkshopVerification(body.pendingVerificationId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user.sub);
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  deleteAccount(@CurrentUser() user: JwtUser, @Body() body: DeleteAccountDto) {
    return this.authService.deleteAccount(user.sub, body.password);
  }
}
