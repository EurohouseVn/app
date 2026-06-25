import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

function getCorsOrigins() {
  const origins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins?.length ? origins : true;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
  origin: [
    'https://app-admin-flame.vercel.app',
    'https://app-admin-45xyvhamj-eurohouse.vercel.app',
  ],
  credentials: true,
});
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`Eurohouse API is running on http://0.0.0.0:${port}/api`);
}

bootstrap();
