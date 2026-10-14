import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryCommandService } from './inventory-command.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryCommandService],
  exports: [InventoryCommandService],
})
export class InventoryModule {}
