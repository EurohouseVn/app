import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryCommandService } from './inventory-command.service';
import { NppGlassStockService } from './glass-stock.service';
import { NppGlassCuttingService } from './glass-cutting.service';
import { NppStocktakeService } from './glass-stocktake.service';
import { NppPrintService } from './glass-print.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryCommandService, NppGlassStockService, NppGlassCuttingService, NppStocktakeService, NppPrintService],
  exports: [InventoryCommandService],
})
export class InventoryModule {}
