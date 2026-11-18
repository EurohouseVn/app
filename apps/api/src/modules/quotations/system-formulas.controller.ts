import { Controller, Get, Param, Post, Put, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Delete, Query, Headers, Res } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import * as fs from 'fs';
import * as path from 'path';

import { FormulaEvaluatorService } from './formula-evaluator.service';
import { imageExtension, IMAGE_UPLOAD_OPTIONS, persistValidatedXlsx, uploadedFileBuffer, XLSX_UPLOAD_OPTIONS } from '../../common/upload';
import { StorageService } from '../storage/storage.service';
import { ManagedCuttingPlanService, type ManagedCuttingPlanInput } from './managed-cutting-plan.service';
import { CuttingPlanPdfService } from './cutting-plan-pdf.service';
import { QuotationsService } from './quotations.service';
import { RequireFormulaAccess } from '../formula-access/formula-access.decorator';

const EUROHOUSE_SYSTEM_NAMES: Record<string, string> = {
  'EU-55': 'Hệ 55 Vát Cạnh',
  'EU-TRUOT': 'Hệ trượt Châu Âu',
};

function displaySystemName(code: string, fallback: string) {
  return EUROHOUSE_SYSTEM_NAMES[code.toUpperCase()] ?? fallback;
}

type ManagedFormulaPayload = {
  aluSystemId?: string;
  name?: string;
  type?: string;
  description?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  inputFields?: Array<{ key?: string; label?: string; unit?: string; type?: 'number' | 'boolean'; required?: boolean; defaultValue?: number | string }>;
  cutRules?: Array<{ profileSystemCode?: string; profileCode?: string; profileName?: string; lengthFormula?: string; quantityFormula?: string; cutAngle?: string; note?: string }>;
  glassRules?: Array<{ name?: string; widthFormula?: string; heightFormula?: string; quantityFormula?: string; note?: string }>;
  sourceRef?: string;
  verificationStatus?: 'CANDIDATE' | 'SOURCE_VERIFIED' | 'FIELD_VERIFIED';
};

@Controller('system-formulas')
@RequireFormulaAccess()
export class SystemFormulasController {
  constructor(
    private prisma: PrismaService,
    private formulaService: FormulaEvaluatorService,
    private storage: StorageService,
    private cuttingPlans: ManagedCuttingPlanService,
    private cuttingPlanPdf: CuttingPlanPdfService,
    private quotations: QuotationsService,
  ) {}

  @Get('managed/systems')
  getManagedSystems() {
    return this.formulaService.getManagedSystems();
  }

  @Get('managed/types')
  getManagedTypes(@Query('aluSystemId') aluSystemId?: string) {
    if (!aluSystemId) return [];
    return this.formulaService.getManagedTypes(aluSystemId);
  }

  @Get('managed/templates')
  getManagedTemplates(@Query('aluSystemId') aluSystemId?: string, @Query('type') type?: string) {
    if (!aluSystemId) return [];
    return this.formulaService.getManagedTemplates(aluSystemId, type);
  }

  @Get('managed/templates/:id')
  getManagedTemplate(@Param('id') id: string) {
    return this.formulaService.getManagedTemplateDetails(id);
  }

  @Post('managed/templates/:id/calc')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  calculateManagedTemplate(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.formulaService.evaluateManagedFormula(id, body);
  }

  @Post('managed/cutting-plan')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  calculateCuttingPlan(@Body() body: ManagedCuttingPlanInput, @CurrentUser() user: JwtUser) {
    return this.cuttingPlans.preview(user.sub, body);
  }

  @Post('managed/cutting-plan/commit-remnants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  commitCuttingPlanRemnants(
    @Body() body: ManagedCuttingPlanInput,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    if (!idempotencyKey) throw new BadRequestException('Thiếu Idempotency-Key khi lưu DC vào kho.');
    return this.cuttingPlans.commitRemnants(user.sub, user.organizationId, body, idempotencyKey);
  }

  @Post('managed/cutting-plan/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async exportCuttingPlanPdf(
    @Body() body: ManagedCuttingPlanInput,
    @CurrentUser() user: JwtUser,
    @Res() res: any,
  ) {
    const plan = await this.cuttingPlans.preview(user.sub, body);
    const profile = await this.quotations.getNppProfile(user.sub);
    const pdf = await this.cuttingPlanPdf.render(plan, profile);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="phieu-cat-nhom-${plan.planRef}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Get('admin/managed/templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getAdminManagedTemplates(@Query('aluSystemId') aluSystemId?: string) {
    if (!aluSystemId) return [];
    return this.formulaService.getManagedTemplates(aluSystemId, undefined, true);
  }

  @Get('admin/managed/templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getAdminManagedTemplate(@Param('id') id: string) {
    return this.formulaService.getManagedTemplateDetails(id, true);
  }

  @Post('admin/managed/templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createManagedTemplate(@Body() body: ManagedFormulaPayload) {
    const payload = await this.validateManagedPayload(body);
    return this.prisma.$transaction(async (tx) => {
      const doorModel = await tx.doorModel.create({
        data: {
          name: payload.name,
          type: payload.type,
          description: payload.description,
          source: 'EUROHOUSE_ADMIN',
          active: true,
        },
      });
      return tx.systemFormula.create({
        data: {
          aluSystemId: payload.aluSystemId,
          doorModelId: doorModel.id,
          inputSchema: payload.inputFields,
          cutRules: payload.cutRules,
          glassRules: payload.glassRules,
          sourceRef: payload.sourceRef,
          verificationStatus: 'CANDIDATE',
          status: payload.status,
          publishedAt: payload.status === 'PUBLISHED' ? new Date() : null,
        },
        include: { doorModel: true, aluSystem: true },
      });
    });
  }

  @Put('admin/managed/templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateManagedTemplate(@Param('id') id: string, @Body() body: ManagedFormulaPayload) {
    const current = await this.prisma.systemFormula.findFirst({
      where: { id, doorModel: { source: 'EUROHOUSE_ADMIN' } },
      include: { doorModel: true },
    });
    if (!current) throw new BadRequestException('Không tìm thấy công thức quản trị.');
    const payload = await this.validateManagedPayload({
      ...body,
      aluSystemId: body.aluSystemId || current.aluSystemId,
      sourceRef: body.sourceRef ?? current.sourceRef,
      verificationStatus: body.verificationStatus ?? current.verificationStatus as ManagedFormulaPayload['verificationStatus'],
    }, current.doorModel.imageUrl);
    const technicalChanged = JSON.stringify(current.inputSchema) !== JSON.stringify(payload.inputFields)
      || JSON.stringify(current.cutRules) !== JSON.stringify(payload.cutRules)
      || JSON.stringify(current.glassRules) !== JSON.stringify(payload.glassRules);
    return this.prisma.$transaction(async (tx) => {
      await tx.doorModel.update({
        where: { id: current.doorModelId },
        data: { name: payload.name, type: payload.type, description: payload.description, active: payload.status !== 'ARCHIVED' },
      });
      return tx.systemFormula.update({
        where: { id },
        data: {
          aluSystemId: payload.aluSystemId,
          inputSchema: payload.inputFields,
          cutRules: payload.cutRules,
          glassRules: payload.glassRules,
          sourceRef: payload.sourceRef,
          verificationStatus: technicalChanged ? 'CANDIDATE' : payload.verificationStatus,
          status: payload.status,
          revision: { increment: 1 },
          publishedAt: payload.status === 'PUBLISHED' ? (current.publishedAt || new Date()) : current.publishedAt,
        },
        include: { doorModel: true, aluSystem: true },
      });
    });
  }

  @Delete('admin/managed/templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteManagedTemplate(@Param('id') id: string) {
    const current = await this.prisma.systemFormula.findFirst({ where: { id, doorModel: { source: 'EUROHOUSE_ADMIN' } } });
    if (!current) return { success: true };
    await this.prisma.doorModel.delete({ where: { id: current.doorModelId } });
    return { success: true };
  }

  @Post('admin/managed/templates/:id/image')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 15, ttl: 600_000 } })
  @UseInterceptors(FileInterceptor('image', IMAGE_UPLOAD_OPTIONS))
  async uploadManagedTemplateImage(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Chưa chọn ảnh mẫu cửa.');
    const formula = await this.prisma.systemFormula.findFirst({ where: { id, doorModel: { source: 'EUROHOUSE_ADMIN' } } });
    if (!formula) throw new BadRequestException('Không tìm thấy công thức quản trị.');
    const fileExt = imageExtension(file);
    const stored = await this.storage.putUpload({
      buffer: await uploadedFileBuffer(file),
      originalName: file.originalname,
      mime: file.mimetype,
      purpose: 'managed-door-model-image',
      extension: fileExt,
      metadata: { systemFormulaId: id, doorModelId: formula.doorModelId },
    });
    if (!stored.publicUrl) throw new BadRequestException('Kho lưu trữ không cung cấp URL công khai cho ảnh mẫu cửa.');
    await this.prisma.doorModel.update({ where: { id: formula.doorModelId }, data: { imageUrl: stored.publicUrl } });
    return this.formulaService.getManagedTemplateDetails(id, true);
  }

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

  private async validateManagedPayload(body: ManagedFormulaPayload, existingImageUrl = '') {
    const aluSystemId = String(body.aluSystemId || '').trim();
    const name = String(body.name || '').trim();
    const type = String(body.type || '').trim();
    const description = String(body.description || '').trim();
    const sourceRef = String(body.sourceRef || 'WebAdmin manual entry').trim();
    const verificationStatus = ['CANDIDATE', 'SOURCE_VERIFIED', 'FIELD_VERIFIED'].includes(String(body.verificationStatus))
      ? String(body.verificationStatus) as 'CANDIDATE' | 'SOURCE_VERIFIED' | 'FIELD_VERIFIED'
      : 'CANDIDATE';
    const status = ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(String(body.status))
      ? String(body.status) as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
      : 'DRAFT';
    if (!aluSystemId || !name || !type) {
      throw new BadRequestException('Hệ nhôm, tên mẫu cửa và loại cửa là bắt buộc.');
    }
    const system = await this.prisma.aluSystem.findFirst({ where: { id: aluSystemId, code: { startsWith: 'EU-' } } });
    if (!system) throw new BadRequestException('Hệ nhôm Eurohouse không hợp lệ.');

    const seenKeys = new Set<string>();
    const inputFields = (Array.isArray(body.inputFields) ? body.inputFields : []).map((field) => {
      const key = String(field.key || '').trim().toUpperCase();
      const label = String(field.label || '').trim();
      if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(key)) throw new BadRequestException(`Mã trường "${key}" không hợp lệ.`);
      if (!label) throw new BadRequestException(`Trường ${key} chưa có tên hiển thị.`);
      if (seenKeys.has(key)) throw new BadRequestException(`Mã trường ${key} đang bị trùng.`);
      seenKeys.add(key);
      const defaultValue = field.defaultValue === '' || field.defaultValue === undefined ? undefined : Number(field.defaultValue);
      if (defaultValue !== undefined && (!Number.isFinite(defaultValue) || defaultValue < 0)) {
        throw new BadRequestException(`Giá trị mặc định của ${key} không hợp lệ.`);
      }
      return {
        key,
        label,
        unit: String(field.unit || 'mm').trim(),
        type: field.type === 'boolean' ? 'boolean' as const : 'number' as const,
        required: field.required !== false,
        ...(defaultValue !== undefined ? { defaultValue } : {}),
      };
    });

    const formulaPattern = /^[A-Za-z0-9_+\-*/().,\s=]+$/;
    const cutRules = (Array.isArray(body.cutRules) ? body.cutRules : []).map((rule) => {
      const profileSystemCode = String(rule.profileSystemCode || system.code).trim().toUpperCase();
      const profileCode = String(rule.profileCode || '').trim().toUpperCase();
      const lengthFormula = String(rule.lengthFormula || '').trim();
      const quantityFormula = String(rule.quantityFormula || '1').trim();
      if (!profileCode) throw new BadRequestException('Mỗi quy tắc cắt phải có mã thanh.');
      if (!lengthFormula || !formulaPattern.test(lengthFormula)) throw new BadRequestException(`Biểu thức chiều dài của ${profileCode} không hợp lệ.`);
      if (!quantityFormula || !formulaPattern.test(quantityFormula)) throw new BadRequestException(`Biểu thức số lượng của ${profileCode} không hợp lệ.`);
      return {
        profileSystemCode,
        profileCode,
        profileName: String(rule.profileName || '').trim(),
        lengthFormula,
        quantityFormula,
        cutAngle: String(rule.cutAngle || '90-90').trim(),
        note: String(rule.note || '').trim(),
      };
    });

    const profileKeys = [...new Map(cutRules.map((rule) => [
      `${rule.profileSystemCode}:${rule.profileCode}`,
      { systemCode: rule.profileSystemCode, profileCode: rule.profileCode },
    ])).values()];
    const profiles = profileKeys.length ? await this.prisma.profile.findMany({
      where: { OR: profileKeys.map((item) => ({ code: item.profileCode, aluSystem: { code: item.systemCode } })) },
      select: { code: true, name: true, aluSystem: { select: { code: true } } },
    }) : [];
    const profileByCode = new Map(profiles.map((profile) => [`${profile.aluSystem.code}:${profile.code.toUpperCase()}`, profile]));
    const missingCodes = profileKeys.filter((item) => !profileByCode.has(`${item.systemCode}:${item.profileCode}`));
    if (missingCodes.length) {
      throw new BadRequestException(`Không tìm thấy mã thanh: ${missingCodes.map((item) => `${item.systemCode}/${item.profileCode}`).join(', ')}.`);
    }
    cutRules.forEach((rule) => {
      if (!rule.profileName) rule.profileName = profileByCode.get(`${rule.profileSystemCode}:${rule.profileCode}`)?.name || rule.profileCode;
    });

    const glassRules = (Array.isArray(body.glassRules) ? body.glassRules : []).map((rule, index) => {
      const name = String(rule.name || '').trim();
      const widthFormula = String(rule.widthFormula || '').trim();
      const heightFormula = String(rule.heightFormula || '').trim();
      const quantityFormula = String(rule.quantityFormula || '1').trim();
      if (!name) throw new BadRequestException(`Quy tắc kính #${index + 1} chưa có tên.`);
      if (!widthFormula || !formulaPattern.test(widthFormula)) throw new BadRequestException(`Biểu thức chiều rộng kính "${name}" không hợp lệ.`);
      if (!heightFormula || !formulaPattern.test(heightFormula)) throw new BadRequestException(`Biểu thức chiều cao kính "${name}" không hợp lệ.`);
      if (!quantityFormula || !formulaPattern.test(quantityFormula)) throw new BadRequestException(`Biểu thức số lượng kính "${name}" không hợp lệ.`);
      return {
        name,
        widthFormula,
        heightFormula,
        quantityFormula,
        note: String(rule.note || '').trim(),
      };
    });

    if (status === 'PUBLISHED') {
      if (!description && !existingImageUrl) throw new BadRequestException('Cần ảnh mẫu cửa hoặc mô tả trước khi phát hành.');
      if (inputFields.length === 0) throw new BadRequestException('Cần ít nhất một trường kích thước trước khi phát hành.');
      if (cutRules.length === 0) throw new BadRequestException('Cần ít nhất một quy tắc cắt trước khi phát hành.');
    }
    return { aluSystemId, name, type, description, status, inputFields, cutRules, glassRules, sourceRef, verificationStatus };
  }
}
