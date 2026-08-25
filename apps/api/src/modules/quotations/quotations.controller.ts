import * as fs from 'fs';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { Body, Controller, Get, Param, Post, Put, Delete, UseGuards, Query, Res, NotFoundException , BadRequestException, UseInterceptors, UploadedFile, Request } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import type { QuotationInput } from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { QuotationPdfService } from './quotation-pdf.service';
import { FormulaEvaluatorService } from './formula-evaluator.service';
import { CuttingOptimizerService, CutRequest } from './cutting-optimizer.service';
import { imageExtension, IMAGE_UPLOAD_OPTIONS, persistUploadedFile } from '../../common/upload';

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
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('logo', IMAGE_UPLOAD_OPTIONS))
  async uploadNppLogo(@Request() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No logo provided');
    const imagesDir = path.join(process.cwd(), 'public', 'images', 'logos');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    const ext = imageExtension(file);
    const filename = `logo-${req.user.sub}-${Date.now()}${ext}`;
    const targetPath = path.join(imagesDir, filename);
    persistUploadedFile(file, targetPath);
    const logoUrl = `/static/images/logos/${filename}`;
    return { url: logoUrl };
  }

  constructor(
    private readonly service: QuotationsService,
    private readonly pdfService: QuotationPdfService,
    private readonly formulaService: FormulaEvaluatorService,
    private readonly cuttingOptimizer: CuttingOptimizerService,
  ) {}

  @Post('quotations/calc')
  calcQuotation(@Body() body: QuotationInput) {
    return this.service.calcQuotation(body);
  }

  @Get('formulas/templates')
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
  async getTemplate(@Param('id') id: string) {
    return this.formulaService.getTemplateDetails(id);
  }

  @Post('formulas/templates/:id/calc')
  async calcTemplate(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.formulaService.evaluateTemplate(id, body);
  }

  @Post('quotations/optimize-cut')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
  async optimizeCut(@Body() requests: CutRequest[], @CurrentUser() user: JwtUser) {
    return this.cuttingOptimizer.optimizeCuts(user.sub, requests);
  }

  @Post('quotations/:id/optimize')
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
  async getQuotationPdf(@Param('id') id: string, @Res() res: any, @CurrentUser() user: JwtUser) {
    const record = await this.service.getQuotation(id, user);
    if (!record) throw new NotFoundException('Không tìm thấy báo giá.');
    let profile = null;
    if (record.createdById) {
      profile = await this.service.getNppProfile(record.createdById);
    }
    const pdfBuffer = await this.pdfService.render(record, profile);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="bao-gia-${record.code}.pdf"`,
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

  @Post('projects/:id/create-order-draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  createOrderDraftFromProject(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.createOrderDraftFromProject(id, user);
  }
}
