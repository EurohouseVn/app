import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminIamService } from './admin-iam.service';
import { CreateNppInput, CreateUserInput, UpdateUserInput, UpdateOrgInput } from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ModuleGuard } from '../../auth/module.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { CeoOnly } from '../../auth/module.decorator';
import { Roles } from '../../auth/roles.decorator';

@Controller('admin')
export class AdminIamController {
  constructor(private readonly service: AdminIamService) {}

  @Get('users')
  @UseGuards(JwtAuthGuard, ModuleGuard)
  @CeoOnly()
  adminUsers() {
    return this.service.adminUsers();
  }

  @Get('departments')
  @UseGuards(JwtAuthGuard, ModuleGuard)
  @CeoOnly()
  adminDepartments() {
    return this.service.listDepartments();
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, ModuleGuard)
  @CeoOnly()
  createUser(@Body() body: CreateUserInput) {
    return this.service.createUser(body);
  }

  @Post('npps')
  @UseGuards(JwtAuthGuard, ModuleGuard)
  @CeoOnly()
  createNpp(@Body() body: CreateNppInput) {
    return this.service.createNpp(body);
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, ModuleGuard)
  @CeoOnly()
  updateUser(@Param('id') id: string, @Body() body: UpdateUserInput) {
    return this.service.updateUser(id, body);
  }

  @Patch('users/:id/modules')
  @UseGuards(JwtAuthGuard, ModuleGuard)
  @CeoOnly()
  setUserModules(@Param('id') id: string, @Body() body: { modules: string[] }) {
    return this.service.setUserModules(id, body.modules ?? []);
  }

  @Get('orgs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  adminOrgs() {
    return this.service.adminOrgs();
  }

  @Patch('orgs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updateOrg(@Param('id') id: string, @Body() body: UpdateOrgInput) {
    return this.service.updateOrg(id, body);
  }
}
