import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { EurohouseController } from './eurohouse/eurohouse.controller';
import { EurohouseService } from './eurohouse/eurohouse.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppController, EurohouseController],
  providers: [AppService, EurohouseService],
})
export class AppModule {}
