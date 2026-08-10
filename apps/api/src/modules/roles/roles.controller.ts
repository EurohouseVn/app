import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ModuleGuard } from '../../auth/module.guard';
import { CeoOnly } from '../../auth/module.decorator';

export class CreateRoleDto {
  name!: string;
  description?: string;
  permissions?: string[];
}

export class UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
}

@Controller('admin/roles')
@UseGuards(JwtAuthGuard, ModuleGuard)
@CeoOnly() // Chỉ CEO mới có quyền quản lý chức danh
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
