import { FileInterceptor } from '@nestjs/platform-express';
import { Body, Controller, Get, Param, Post, Put, Delete, UseGuards, Query, Res, NotFoundException , BadRequestException, UseInterceptors, UploadedFile, Request } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import type { QuotationInput } from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { QuotationPdfService, type QuotationPdfKind } from './quotation-pdf.service';
import { FormulaEvaluatorService } from './formula-evaluator.service';
import { CuttingOptimizerService, CutRequest } from './cutting-optimizer.service';
import { imageExtension, IMAGE_UPLOAD_OPTIONS, uploadedFileBuffer } from '../../common/upload';
import { StorageService } from '../storage/storage.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { QuotationContractPdfService, type ContractTermsInput } from './quotation-contract-pdf.service';
import { RequireFormulaAccess } from '../formula-access/formula-access.decorator';
import { RequiresEurohouseFeature } from '../eurohouse-access/eurohouse-feature.decorator';

@Controller()
export class QuotationsController {
  @Get('npp/profile')
  @UseGuards(JwtAuthGuard)
  getNppProfile(@CurrentUser() user: JwtUser) {
    return this.service.getNppProfile(user.sub);
  }

  @Put('npp/profile')
  @UseGuards(JwtAuthGuard)
  updateNppProfile(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.service.updateNppProfile(user.sub, body);
  }


  @Post('npp/profile/logo')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 600_000 } })
  @UseInterceptors(FileInterceptor('logo', IMAGE_UPLOAD_OPTIONS))
  async uploadNppLogo(@Request() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No logo provided');
    const ext = imageExtension(file);
    const stored = await this.storage.putUpload({ buffer: await uploadedFileBuffer(file), originalName: file.originalname, mime: file.mimetype, purpose: 'npp-logo', ownerOrganizationId: req.user.organizationId, ownerUserId: req.user.sub, extension: ext });
    if (!stored.publicUrl) throw new BadRequestException('Storage provider does not expose a public URL for logos.');
    const logoUrl = stored.publicUrl;
    await this.service.updateOrganizationLogo(req.user.sub, logoUrl);
    return { url: logoUrl, profile: await this.service.getNppProfile(req.user.sub) };
  }

  constructor(
    private readonly service: QuotationsService,
    private readonly pdfService: QuotationPdfService,
    private readonly contractPdf: QuotationContractPdfService,
    private readonly formulaService: FormulaEvaluatorService,
    private readonly cuttingOptimizer: CuttingOptimizerService,
    private readonly storage: StorageService,
  ) {}

  @Post('quotations/calc')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  calcQuotation(@Body() body: QuotationInput) {
    return this.service.calcQuotation(body);
  }

  @Get('formulas/templates')
  @RequireFormulaAccess()
  listTemplates(
    @Query('q') query?: string,
    @Query('systemName') systemName?: string,
    @Query('windowTypeName') windowTypeName?: string,
    @Query('onlyPopular') onlyPopular?: string,
  ) {
    const popular = onlyPopular === 'true' ? true : onlyPopular === 'false' ? false : undefined;
    return this.formulaService.getTemplates(query, systemName, windowTypeName, popular);
  }

  @Post('formulas/templates/:id/popular')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async togglePopular(@Param('id') id: string, @Body() body: { isPopular: boolean }) {
    return this.formulaService.togglePopular(id, body.isPopular);
  }

  @Get('formulas/templates/:id')
  @RequireFormulaAccess()
  async getTemplate(@Param('id') id: string) {
    return this.formulaService.getTemplateDetails(id);
  }

  @Post('formulas/templates/:id/calc')
  @RequireFormulaAccess()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async calcTemplate(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.formulaService.evaluateTemplate(id, body);
  }

  @Post('quotations/optimize-cut')
  @RequireFormulaAccess()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
  async optimizeCut(@Body() requests: CutRequest[], @CurrentUser() user: JwtUser) {
    return this.cuttingOptimizer.optimizeCuts(user.sub, requests);
  }

  @Post('quotations/:id/optimize')
  @RequireFormulaAccess()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
  async optimizeQuotation(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const quotation = await this.service.getQuotation(id, user);
    if (!quotation) throw new NotFoundException('Không tìm thấy báo giá.');
    
    const cutRequests: Record<string, { materialCode: string; systemCode?: string; lengths: number[] }> = {};
    
    for (const item of quotation.items) {
      if (!item.templateId) continue;
      try {
        const result = await this.formulaService.evaluateTemplate(item.templateId, {
          width: item.widthMm,
          height: item.heightMm,
          quantity: item.quantity
        });
        
        // Extract aluminum cuts
        if (result.aluminum && Array.isArray(result.aluminum)) {
          for (const alu of result.aluminum) {
            const code = alu.code;
            const length = alu.length_mm;
            const qty = alu.quantity;
            if (code && length && qty) {
              const key = `${item.system || ''}:${code}`;
              if (!cutRequests[key]) cutRequests[key] = { materialCode: code, systemCode: item.system, lengths: [] };
              for (let i = 0; i < qty; i++) {
                cutRequests[key].lengths.push(length);
              }
            }
          }
        }
      } catch (e) {
        // Ignore template error for this item
      }
    }
    
    const formattedRequests: CutRequest[] = Object.values(cutRequests);
    
    if (formattedRequests.length === 0) {
      return { materials: [], totalScrapWeight: 0, total6mBars: 0 };
    }
    
    return this.cuttingOptimizer.optimizeCuts(user.sub, formattedRequests);
  }

  @Post('quotations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  createQuotation(@Body() body: QuotationInput, @CurrentUser() user: JwtUser) {
    return this.service.createQuotation(body, user.sub);
  }

  @Put('quotations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  updateQuotation(@Param('id') id: string, @Body() body: QuotationInput, @CurrentUser() user: JwtUser) {
    return this.service.updateQuotation(id, body, user.sub, user);
  }

  @Delete('quotations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  deleteQuotation(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.deleteQuotation(id, user.sub, user);
  }

  @Get('quotations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  listQuotations(@Query('page') page?: string, @Query('mine') mine?: string, @CurrentUser() user?: JwtUser) {
    const createdById = (mine === 'true' || (user && user.role !== 'ADMIN' && user.role !== 'STAFF')) ? user?.sub : undefined;
    if (page) return this.service.listQuotations({ createdById, page: parseInt(page, 10) }, user);
    return this.service.listQuotations({ createdById }, user);
  }

  @Get('quotations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  getQuotation(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.getQuotation(id, user);
  }

  @Get('quotations/:id/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  async getQuotationPdf(
    @Param('id') id: string,
    @Query('type') type: string | undefined,
    @Res() res: any,
    @CurrentUser() user: JwtUser,
  ) {
    const record = await this.service.getQuotation(id, user);
    if (!record) throw new NotFoundException('Không tìm thấy báo giá.');
    const profile = await this.service.getNppProfile(record.createdById || user.sub);
    const kind: QuotationPdfKind = type === 'estimate' ? 'estimate' : 'quotation';
    const pdfBuffer = await this.pdfService.render(record, profile, kind);
    const filePrefix = kind === 'estimate' ? 'du-toan' : 'bao-gia';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filePrefix}-${record.code}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Post('quotations/:id/convert-to-project')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  convertToProject(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.convertToProject(id, user);
  }

  @Post('quotations/:id/contract-pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  async getContractPdf(@Param('id') id: string, @Body() body: ContractTermsInput, @Res() res: any, @CurrentUser() user: JwtUser) {
    const record = await this.service.getQuotation(id, user);
    const profile = await this.service.getNppProfile(record.createdById || user.sub);
    const pdf = await this.contractPdf.render(record, profile, body);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="hop-dong-${record.code}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Post('projects/:id/create-order-draft')
  @RequiresEurohouseFeature('EUROHOUSE_ORDERING')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  createOrderDraftFromProject(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.createOrderDraftFromProject(id, user);
  }
}
