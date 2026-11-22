import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminIamModule } from './modules/admin-iam/admin-iam.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WarrantyModule } from './modules/warranty/warranty.module';
import { FinanceModule } from './modules/finance/finance.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { OrdersModule } from './modules/orders/orders.module';
import { RolesModule } from './modules/roles/roles.module';
import { SalesModule } from './modules/sales/sales.module';
import { ProductionModule } from './modules/production/production.module';
import { ContentModule } from './modules/content/content.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { AiModule } from './modules/ai/ai.module';
import { TaxInvoiceModule } from './modules/tax-invoice/tax-invoice.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { StorageModule } from './modules/storage/storage.module';
import { ManufacturingModule } from './modules/manufacturing/manufacturing.module';
import { WorkshopOperationsModule } from './modules/workshop-operations/workshop-operations.module';
import { WebsiteContentModule } from './modules/website-content/website-content.module';
import { FormulaAccessModule } from './modules/formula-access/formula-access.module';
import { EurohouseAccessModule } from './modules/eurohouse-access/eurohouse-access.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveStaticOptions: {
        fallthrough: false,
      },
    }),
    PrismaModule,
    EurohouseAccessModule,
    FormulaAccessModule,
    StorageModule,
    AuthModule,
    AdminIamModule,
    CatalogModule,
    ProjectsModule,
    InventoryModule,
    WarrantyModule,
    FinanceModule,
    LoyaltyModule,
    QuotationsModule,
    OrdersModule,
    RolesModule,
    SalesModule,
    ProductionModule,
    ContentModule,
    NotificationsModule,
    WorkforceModule,
    AiModule,
    TaxInvoiceModule,
    ManufacturingModule,
    WorkshopOperationsModule,
    WebsiteContentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
