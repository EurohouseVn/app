import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EurohouseController } from './eurohouse/eurohouse.controller';
import { EurohouseService } from './eurohouse/eurohouse.service';
import { QuotationPdfService } from './eurohouse/quotation-pdf.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController, EurohouseController],
  providers: [AppService, EurohouseService, QuotationPdfService],
})
export class AppModule {}
