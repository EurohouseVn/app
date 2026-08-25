import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';

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

  @Patch('profiles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updateProfile(@Param('id') id: string, @Body() body: { pricePerKg?: number }) {
    return this.service.updateProfile(id, body);
  }
}
