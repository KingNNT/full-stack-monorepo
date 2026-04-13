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
import { CreatePermissionRequestDto } from '../dtos/create-permission.request.dto';
import { UpdatePermissionRequestDto } from '../dtos/update-permission.request.dto';
import { PermissionGuard } from '../guards/permission.guard';

@ApiTags('RBAC / Permissions')
@Controller('rbac/permissions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PermissionsController {
  constructor(
    @Inject(RBAC_REPOSITORY_TOKEN)
    private readonly rbacRepo: IRbacRepository,
  ) {}

  @Post()
  @RequirePermissions('permissions.create')
  @ApiOperation({ summary: 'Create a new permission' })
  async create(@Body() dto: CreatePermissionRequestDto) {
    const existing = await this.rbacRepo.findPermissionByName(dto.name);
    if (existing) {
      throw new ConflictException('Permission name already exists');
    }
    return this.rbacRepo.createPermission(dto.name, dto.description);
  }

  @Get()
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'List all permissions' })
  async findAll() {
    return this.rbacRepo.findAllPermissions();
  }

  @Get(':id')
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Get a permission by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const permission = await this.rbacRepo.findPermissionById(id);
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  @Patch(':id')
  @RequirePermissions('permissions.update')
  @ApiOperation({ summary: 'Update a permission' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionRequestDto,
  ) {
    const permission = await this.rbacRepo.findPermissionById(id);
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    if (dto.name) {
      const existing = await this.rbacRepo.findPermissionByName(dto.name);
      if (existing && existing.id !== id) {
        throw new ConflictException('Permission name already exists');
      }
    }
    await this.rbacRepo.updatePermission(id, dto);
    return this.rbacRepo.findPermissionById(id);
  }

  @Delete(':id')
  @RequirePermissions('permissions.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a permission' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const permission = await this.rbacRepo.findPermissionById(id);
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    await this.rbacRepo.softDeletePermission(id);
  }
}
