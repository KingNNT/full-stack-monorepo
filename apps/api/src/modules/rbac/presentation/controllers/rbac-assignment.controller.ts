import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import {
  type IRbacRepository,
  RBAC_REPOSITORY_TOKEN,
} from '../../application/ports/rbac.repository.interface';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AssignPermissionRequestDto } from '../dtos/assign-permission.request.dto';
import { AssignRoleRequestDto } from '../dtos/assign-role.request.dto';
import { PermissionGuard } from '../guards/permission.guard';

@ApiTags('RBAC')
@Controller('rbac')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RbacAssignmentController {
  constructor(
    @Inject(RBAC_REPOSITORY_TOKEN)
    private readonly rbacRepo: IRbacRepository,
  ) {}

  @Post('assign/role')
  @RequirePermissions('rbac.assign-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign a role to a model',
  })
  async assignRole(@Body() dto: AssignRoleRequestDto) {
    await this.rbacRepo.assignRoleToModel(
      dto.model_type,
      dto.model_id,
      dto.role_id,
    );
    return { message: 'Role assigned' };
  }

  @Post('revoke/role')
  @RequirePermissions('rbac.revoke-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke a role from a model',
  })
  async revokeRole(@Body() dto: AssignRoleRequestDto) {
    await this.rbacRepo.revokeRoleFromModel(
      dto.model_type,
      dto.model_id,
      dto.role_id,
    );
    return { message: 'Role revoked' };
  }

  @Post('assign/permission')
  @RequirePermissions('rbac.assign-permission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign a permission to a model',
  })
  async assignPermission(@Body() dto: AssignPermissionRequestDto) {
    await this.rbacRepo.assignPermissionToModel(
      dto.model_type,
      dto.model_id,
      dto.permission_id,
    );
    return { message: 'Permission assigned' };
  }

  @Post('revoke/permission')
  @RequirePermissions('rbac.revoke-permission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke a permission from a model',
  })
  async revokePermission(@Body() dto: AssignPermissionRequestDto) {
    await this.rbacRepo.revokePermissionFromModel(
      dto.model_type,
      dto.model_id,
      dto.permission_id,
    );
    return { message: 'Permission revoked' };
  }

  @Get('model/:modelType/:modelId/permissions')
  @RequirePermissions('rbac.read')
  @ApiOperation({
    summary: 'Get all resolved permissions for a model',
  })
  async getModelPermissions(
    @Param('modelType') modelType: string,
    @Param('modelId', ParseUUIDPipe) modelId: string,
  ) {
    return this.rbacRepo.resolveModelPermissions(modelType, modelId);
  }

  @Get('model/:modelType/:modelId/roles')
  @RequirePermissions('rbac.read')
  @ApiOperation({
    summary: 'Get all roles for a model',
  })
  async getModelRoles(
    @Param('modelType') modelType: string,
    @Param('modelId', ParseUUIDPipe) modelId: string,
  ) {
    return this.rbacRepo.findRolesByModel(modelType, modelId);
  }
}
