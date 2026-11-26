import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryCommandService } from './inventory-command.service';
import { NppGlassStockService } from './glass-stock.service';
import { NppGlassCuttingService } from './glass-cutting.service';
import { NppStocktakeService } from './glass-stocktake.service';
import { NppPrintService } from './glass-print.service';
import { NppDocumentService } from './document.service';
import { NppDocumentController } from './document.controller';
import { OCR_PROVIDER, resolveOcrProvider } from './ocr-provider';

@Module({
  controllers: [InventoryController, NppDocumentController],
  providers: [InventoryService, InventoryCommandService, NppGlassStockService, NppGlassCuttingService, NppStocktakeService, NppPrintService, NppDocumentService, { provide: OCR_PROVIDER, useFactory: () => resolveOcrProvider() }],
  exports: [InventoryCommandService],
})
export class InventoryModule {}
