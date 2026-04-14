import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  type IRbacRepository,
  RBAC_REPOSITORY_TOKEN,
} from '../../application/ports/rbac.repository.interface';
import {
  MODEL_TYPE_USER,
  SUPER_ADMIN_ROLE,
} from '../../domain/constants/rbac.constants';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RBAC_REPOSITORY_TOKEN)
    private readonly rbacRepo: IRbacRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.sub;

    if (!userId) {
      throw new ForbiddenException({
        message: 'Forbidden',
        errorCode: 'FORBIDDEN',
      });
    }

    // Super-admin bypass
    const isSuperAdmin = await this.rbacRepo.modelHasRole(
      MODEL_TYPE_USER,
      userId,
      SUPER_ADMIN_ROLE,
    );
    if (isSuperAdmin) {
      return true;
    }

    // Resolve all permissions
    const userPermissions = await this.rbacRepo.resolveModelPermissions(
      MODEL_TYPE_USER,
      userId,
    );
    const permissionNames = new Set(userPermissions.map((p) => p.name));

    // Check ALL required permissions are present
    const hasAll = requiredPermissions.every((p) => permissionNames.has(p));
    if (!hasAll) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        errorCode: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    return true;
  }
}
