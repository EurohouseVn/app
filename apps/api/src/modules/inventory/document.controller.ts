import { Body, Controller, Get, Param, Post, Put, StreamableFile, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CreateDocumentDraftInput, UpdateDocumentDraftInput } from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { NppDocumentService } from './document.service';

/** Đọc phiếu: ảnh đơn viết tay của thợ hoặc hóa đơn in → bản nháp → sửa → chốt thành đơn hoặc nhập kho. */
@Controller('npp/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('NPP')
export class NppDocumentController {
  constructor(private readonly documents: NppDocumentService) {}

  @Get('status')
  status() {
    return this.documents.status();
  }

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.documents.listDrafts(user.organizationId!);
  }

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 600_000 } })
  create(@Body() body: CreateDocumentDraftInput, @CurrentUser() user: JwtUser) {
    return this.documents.createDraft(user.organizationId!, user.sub, body);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.documents.getDraft(user.organizationId!, id);
  }

  @Put(':id/lines')
  updateLines(@Param('id') id: string, @Body() body: UpdateDocumentDraftInput, @CurrentUser() user: JwtUser) {
    return this.documents.updateDraft(user.organizationId!, id, body);
  }

  @Get(':id/image')
  async image(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const { mime, body } = await this.documents.readImage(user.organizationId!, id);
    return new StreamableFile(body, { type: mime, disposition: 'inline' });
  }

  @Post(':id/order-input')
  orderInput(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.documents.buildOrderInput(user.organizationId!, id);
  }

  @Post(':id/confirm-order')
  confirmOrder(@Param('id') id: string, @Body() body: { resultRef?: string }, @CurrentUser() user: JwtUser) {
    return this.documents.confirmOrder(user.organizationId!, user.sub, id, { resultRef: body?.resultRef ?? '' });
  }

  @Post(':id/confirm-receipt')
  confirmReceipt(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.documents.confirmReceipt(user.organizationId!, user.sub, id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.documents.reject(user.organizationId!, id);
  }
}
