import { Controller, Get, Param, Post, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Delete, Query } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import * as fs from 'fs';
import * as path from 'path';

import { FormulaEvaluatorService } from './formula-evaluator.service';
import { imageExtension, IMAGE_UPLOAD_OPTIONS, persistValidatedXlsx, uploadedFileBuffer, XLSX_UPLOAD_OPTIONS } from '../../common/upload';
import { StorageService } from '../storage/storage.service';

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
    private formulaService: FormulaEvaluatorService,
    private storage: StorageService,
  ) {}

  @Get('systems')
  async getSystems() {
    const systems = await this.prisma.aluSystem.findMany({
      where: { code: { startsWith: 'EU-' } },
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
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD_OPTIONS))
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
    await persistValidatedXlsx(file, filePath);
    const stored = await this.storage.putUpload({
      buffer: await fs.promises.readFile(filePath),
      originalName: file.originalname,
      mime: file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      purpose: 'system-formula-xlsx',
      extension: '.xlsx',
      metadata: { systemId, doorModelId, systemFormulaId: formula.id },
    });
    await fs.promises.rm(filePath, { force: true });

    return this.prisma.systemFormula.update({
      where: { id: formula.id },
      data: { excelFilePath: `storage://${stored.id}` }
    });
  }

  @Post('door-designs/:id/image')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 15, ttl: 600_000 } })
  @UseInterceptors(FileInterceptor('image', IMAGE_UPLOAD_OPTIONS))
  async uploadDoorImage(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No image provided');

    const fileExt = imageExtension(file);
    const stored = await this.storage.putUpload({ buffer: await uploadedFileBuffer(file), originalName: file.originalname, mime: file.mimetype, purpose: 'door-model-image', extension: fileExt, metadata: { doorModelId: id } });
    if (!stored.publicUrl) throw new BadRequestException('Storage provider does not expose a public URL for door images.');
    const imageUrl = stored.publicUrl;
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async calcSystemFormula(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.formulaService.evaluateSystemFormula(id, body);
  }
}
