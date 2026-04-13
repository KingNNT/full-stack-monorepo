import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
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
import type { CreateRoleRequestDto } from '../dtos/create-role.request.dto';
import type { SyncPermissionsRequestDto } from '../dtos/sync-permissions.request.dto';
import type { UpdateRoleRequestDto } from '../dtos/update-role.request.dto';
import { PermissionGuard } from '../guards/permission.guard';

@ApiTags('RBAC / Roles')
@Controller('rbac/roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RolesController {
  constructor(
    @Inject(RBAC_REPOSITORY_TOKEN)
    private readonly rbacRepo: IRbacRepository,
  ) {}

  @Post()
  @RequirePermissions('roles.create')
  @ApiOperation({ summary: 'Create a new role' })
  async create(@Body() dto: CreateRoleRequestDto) {
    const existing = await this.rbacRepo.findRoleByName(dto.name);
    if (existing) {
      throw new ConflictException('Role name already exists');
    }
    return this.rbacRepo.createRole(dto.name, dto.description);
  }

  @Get()
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'List all roles' })
  async findAll() {
    return this.rbacRepo.findAllRoles();
  }

  @Get(':id')
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'Get a role by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.rbacRepo.findRoleById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    const permissions = await this.rbacRepo.findPermissionsByRoleId(id);
    return { ...role, permissions };
  }

  @Patch(':id')
  @RequirePermissions('roles.update')
  @ApiOperation({ summary: 'Update a role' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleRequestDto,
  ) {
    const role = await this.rbacRepo.findRoleById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (dto.name) {
      const existing = await this.rbacRepo.findRoleByName(dto.name);
      if (existing && existing.id !== id) {
        throw new ConflictException('Role name already exists');
      }
    }
    await this.rbacRepo.updateRole(id, dto);
    return this.rbacRepo.findRoleById(id);
  }

  @Delete(':id')
  @RequirePermissions('roles.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.rbacRepo.findRoleById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    await this.rbacRepo.softDeleteRole(id);
  }

  @Post(':id/permissions')
  @RequirePermissions('roles.assign-permissions')
  @ApiOperation({
    summary: 'Sync permissions to a role',
  })
  async syncPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SyncPermissionsRequestDto,
  ) {
    const role = await this.rbacRepo.findRoleById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    await this.rbacRepo.syncPermissionsToRole(id, dto.permission_ids);
    return this.rbacRepo.findPermissionsByRoleId(id);
  }
}
