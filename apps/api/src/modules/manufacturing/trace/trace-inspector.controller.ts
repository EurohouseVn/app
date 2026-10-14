import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtUser } from '../../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { Roles } from '../../../auth/roles.decorator';
import { RolesGuard } from '../../../auth/roles.guard';
import { assertManufacturingFeatureEnabled } from '../feature-flags';
import { TraceInspectorService } from './trace-inspector.service';

@Controller('manufacturing/v2/traces')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TraceInspectorController {
  constructor(private readonly traces: TraceInspectorService) {}

  @Get()
  list(@CurrentUser() user: JwtUser | undefined) { assertManufacturingFeatureEnabled('traceInspector'); return this.traces.list(user); }

  @Get(':id')
  detail(@CurrentUser() user: JwtUser | undefined, @Param('id') id: string) { assertManufacturingFeatureEnabled('traceInspector'); return this.traces.detail(user, id); }
}
