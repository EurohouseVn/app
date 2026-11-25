import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryCommandService } from './inventory-command.service';
import { NppGlassStockService } from './glass-stock.service';
import { NppGlassCuttingService } from './glass-cutting.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryCommandService, NppGlassStockService, NppGlassCuttingService],
  exports: [InventoryCommandService],
})
export class InventoryModule {}
