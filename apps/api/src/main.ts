import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

function getCorsOrigins(): string[] {
  return process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
}

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  const configuredOrigins = getCorsOrigins();
  if (configuredOrigins.length === 0) return true;
  if (configuredOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return /^https:\/\/eurohouse-(api|admin|npp|mobile)\.onrender\.com$/.test(origin);
}

function getStaticPublicDirs() {
  return [
    join(process.cwd(), 'apps', 'api', 'public'),
    join(process.cwd(), 'public'),
  ].filter((dir, index, dirs) => existsSync(dir) && dirs.indexOf(dir) === index);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Phục vụ ảnh tĩnh (poster khuyến mãi, thư viện)
  for (const publicDir of getStaticPublicDirs()) {
    app.useStaticAssets(publicDir, { prefix: '/static' });
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`Eurohouse API is running on http://0.0.0.0:${port}/api`);
}

bootstrap();
