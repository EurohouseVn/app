import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get('systems')
  catalog() {
    return this.service.catalog();
  }

  @Get('colors')
  colors() {
    return this.service.colors();
  }
}
