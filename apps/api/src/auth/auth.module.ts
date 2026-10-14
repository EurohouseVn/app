import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { ModuleGuard } from './module.guard';

const INSECURE_PRODUCTION_SECRETS = new Set([
  '',
  'eurohouse-dev-secret-change-me',
  'change-me',
  'secret',
]);

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env) {
  const value = (env.JWT_SECRET ?? '').trim();
  if (env.NODE_ENV === 'production' && (INSECURE_PRODUCTION_SECRETS.has(value.toLowerCase()) || value.length < 32)) {
    throw new Error('JWT_SECRET must be a non-placeholder secret of at least 32 characters in production.');
  }
  return value || 'eurohouse-dev-secret-change-me';
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: resolveJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, ModuleGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, ModuleGuard],
})
export class AuthModule {}
