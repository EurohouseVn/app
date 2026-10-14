import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ProjectDetail } from '@eurohouse/types';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { ProjectsService } from './projects.service';
import { imageExtension, IMAGE_UPLOAD_OPTIONS, uploadedFileBuffer } from '../../common/upload';
import { StorageService } from '../storage/storage.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

const ALLOWED_ROLES = ['ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY'] as const;

@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService, private readonly storage: StorageService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALLOWED_ROLES)
  listProjects(@Query('mine') mine?: string, @CurrentUser() user?: JwtUser) {
    return this.service.listProjects(user, mine === 'true');
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALLOWED_ROLES)
  createProject(@Body() body: Partial<ProjectDetail>, @CurrentUser() user: JwtUser) {
    return this.service.createProject(body, user.sub, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALLOWED_ROLES)
  getProject(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.getProject(id, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALLOWED_ROLES)
  updateProject(@Param('id') id: string, @Body() body: Partial<ProjectDetail>, @CurrentUser() user: JwtUser) {
    return this.service.updateProject(id, body, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALLOWED_ROLES)
  deleteProject(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.deleteProject(id, user);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles(...ALLOWED_ROLES)
  @Throttle({ default: { limit: 12, ttl: 600_000 } })
  @UseInterceptors(FileInterceptor('image', IMAGE_UPLOAD_OPTIONS))
  async uploadProjectImage(@Param('id') id: string, @UploadedFile() file: any, @CurrentUser() user: JwtUser) {
    if (!file) throw new BadRequestException('Chua chon file anh');

    const project = await this.service.getProject(id, user);
    const currentImages = project.images || [];
    if (currentImages.length >= 5) throw new BadRequestException('Công trình chỉ được lưu tối đa 5 ảnh.');

    const ext = imageExtension(file);
    const stored = await this.storage.putUpload({
      buffer: await uploadedFileBuffer(file),
      originalName: file.originalname,
      mime: file.mimetype,
      purpose: 'project-image',
      ownerOrganizationId: user.organizationId,
      ownerUserId: user.sub,
      extension: ext,
      metadata: { projectId: id },
    });
    if (!stored.publicUrl) throw new BadRequestException('Storage provider does not expose a public URL for project images.');
    const imageUrl = stored.publicUrl;

    const updatedImages = [...currentImages, imageUrl];
    await this.service.updateProject(id, { images: updatedImages }, user);

    return { url: imageUrl, images: updatedImages };
  }
}
