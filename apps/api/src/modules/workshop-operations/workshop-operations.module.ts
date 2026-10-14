import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { WorkshopOperationsController } from './workshop-operations.controller';
import { WorkshopAccessService } from './workshop-access.service';
import { WorkshopEventWorkerService } from './workshop-event-worker.service';
import { WorkshopOperationsService } from './workshop-operations.service';
import { WorkshopPilotGuard } from './workshop-pilot.guard';
import { WorkshopPilotService } from './workshop-pilot.service';
import { ProjectFinancialPdfService } from './project-financial-pdf.service';

@Module({
  imports: [InventoryModule],
  controllers: [WorkshopOperationsController],
  providers: [WorkshopOperationsService, WorkshopAccessService, WorkshopPilotService, WorkshopPilotGuard, WorkshopEventWorkerService, ProjectFinancialPdfService],
  exports: [WorkshopOperationsService, WorkshopPilotService, WorkshopEventWorkerService],
})
export class WorkshopOperationsModule {}
