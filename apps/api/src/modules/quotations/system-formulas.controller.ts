import { Controller, Get, Param, Post, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Delete, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import * as fs from 'fs';
import * as path from 'path';

import { FormulaEvaluatorService } from './formula-evaluator.service';

const EUROHOUSE_SYSTEM_NAMES: Record<string, string> = {
  'EU-55': 'Hệ 55 Euroqueen',
  'EU-TRUOT': 'Hệ trượt Châu Âu',
};

function displaySystemName(code: string, fallback: string) {
  return EUROHOUSE_SYSTEM_NAMES[code.toUpperCase()] ?? fallback;
}

@Controller('system-formulas')
export class SystemFormulasController {
  constructor(
    private prisma: PrismaService,
    private formulaService: FormulaEvaluatorService
  ) {}

  @Get('systems')
  async getSystems() {
    const systems = await this.prisma.aluSystem.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return systems.map((system) => ({
      ...system,
      name: displaySystemName(system.code, system.name),
    }));
  }

  @Get('template-systems')
  async getTemplateSystems() {
    return this.formulaService.getTemplateSystems();
  }

  @Get('template-types')
  async getTemplateTypes(@Query('eurohouseSystemId') eurohouseSystemId?: string) {
    return this.formulaService.getTemplateWindowTypes(eurohouseSystemId);
  }

  @Get('templates')
  async getTemplates(
    @Query('windowTypeName') windowTypeName: string,
    @Query('eurohouseSystemId') eurohouseSystemId?: string,
    @Query('sourceSystemName') sourceSystemName?: string,
    @Query('onlyPopular') onlyPopular?: string,
    @Query('preferPopular') preferPopular?: string,
  ) {
    if (!windowTypeName) return [];
    const popular = onlyPopular === 'true' ? true : onlyPopular === 'false' ? false : undefined;
    return this.formulaService.getTemplatesForSystem(windowTypeName, {
      eurohouseSystemId,
      sourceSystemName,
      onlyPopular: popular,
      preferPopular: preferPopular === 'true',
    });
  }

  @Get('door-designs')
  async getDoorDesigns() {
    return this.prisma.doorModel.findMany({
      orderBy: { type: 'asc' }
    });
  }

  @Delete('door-designs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async bulkDeleteDoorDesigns(@Body() body: { ids: string[] }) {
    if (!body.ids || body.ids.length === 0) return { count: 0 };
    return this.prisma.doorModel.deleteMany({
      where: { id: { in: body.ids } }
    });
  }

  @Delete('door-designs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteDoorDesign(@Param('id') id: string) {
    return this.prisma.doorModel.delete({ where: { id } });
  }

  @Get('systems/:systemId/formulas')
  async getSystemFormulas(@Param('systemId') systemId: string) {
    return this.prisma.systemFormula.findMany({
      where: { aluSystemId: systemId },
      include: { doorModel: true },
    });
  }

  @Post('systems/:systemId/formulas/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async toggleFormula(
    @Param('systemId') systemId: string,
    @Body() body: { doorModelId: string; active: boolean }
  ) {
    if (body.active) {
      const exists = await this.prisma.systemFormula.findUnique({
        where: { aluSystemId_doorModelId: { aluSystemId: systemId, doorModelId: body.doorModelId } }
      });
      if (!exists) {
        return this.prisma.systemFormula.create({
          data: {
            aluSystemId: systemId,
            doorModelId: body.doorModelId,
          }
        });
      }
      return exists;
    } else {
      await this.prisma.systemFormula.delete({
        where: { aluSystemId_doorModelId: { aluSystemId: systemId, doorModelId: body.doorModelId } }
      }).catch(() => null);
      return { success: true };
    }
  }

  @Post('systems/:systemId/formulas/:doorModelId/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(
    @Param('systemId') systemId: string,
    @Param('doorModelId') doorModelId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    
    const formula = await this.prisma.systemFormula.findUnique({
      where: { aluSystemId_doorModelId: { aluSystemId: systemId, doorModelId } }
    });
    if (!formula) throw new BadRequestException('Formula not mapped');

    const uploadsDir = path.join(process.cwd(), 'uploads', 'formulas', systemId);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, `${doorModelId}.xlsx`);
    fs.writeFileSync(filePath, file.buffer);

    return this.prisma.systemFormula.update({
      where: { id: formula.id },
      data: { excelFilePath: filePath }
    });
  }

  @Post('door-designs/:id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('image'))
  async uploadDoorImage(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No image provided');

    // Create public directory for static images if it doesn't exist
    const imagesDir = path.join(process.cwd(), 'public', 'images', 'doors');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const fileExt = path.extname(file.originalname) || '.png';
    const fileName = `${id}-${Date.now()}${fileExt}`;
    const filePath = path.join(imagesDir, fileName);
    
    fs.writeFileSync(filePath, file.buffer);

    // Update the door model with the new image URL relative to public dir
    const imageUrl = `/images/doors/${fileName}`;
    return this.prisma.doorModel.update({
      where: { id },
      data: { imageUrl }
    });
  }

  @Get('formulas/:id')
  async getFormulaDetails(@Param('id') id: string) {
    return this.formulaService.getSystemFormulaDetails(id);
  }

  @Post('formulas/:id/calc')
  async calcSystemFormula(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.formulaService.evaluateSystemFormula(id, body);
  }
}
