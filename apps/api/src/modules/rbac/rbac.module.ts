import { Module } from '@nestjs/common';
import { RBAC_REPOSITORY_TOKEN } from './application/ports/rbac.repository.interface';
import { RbacRepository } from './infrastructure/persistence/rbac.repository';
import { PermissionsController } from './presentation/controllers/permissions.controller';
import { RbacAssignmentController } from './presentation/controllers/rbac-assignment.controller';
import { RolesController } from './presentation/controllers/roles.controller';
import { PermissionGuard } from './presentation/guards/permission.guard';

@Module({
  controllers: [
    RolesController,
    PermissionsController,
    RbacAssignmentController,
  ],
  providers: [
    RbacRepository,
    {
      provide: RBAC_REPOSITORY_TOKEN,
      useExisting: RbacRepository,
    },
    PermissionGuard,
  ],
  exports: [RBAC_REPOSITORY_TOKEN, PermissionGuard],
})
export class RbacModule {}
