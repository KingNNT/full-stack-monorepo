import type { PermissionRow } from '../../../../shared/infrastructure/database/schema/permissions.table';
import type { RoleRow } from '../../../../shared/infrastructure/database/schema/roles.table';

export const RBAC_REPOSITORY_TOKEN = Symbol('IRbacRepository');

export interface IRbacRepository {
  // Roles
  createRole(name: string, description?: string): Promise<RoleRow>;
  findRoleById(id: string): Promise<RoleRow | null>;
  findRoleByName(name: string): Promise<RoleRow | null>;
  findAllRoles(): Promise<RoleRow[]>;
  updateRole(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<void>;
  softDeleteRole(id: string): Promise<void>;

  // Permissions
  createPermission(name: string, description?: string): Promise<PermissionRow>;
  findPermissionById(id: string): Promise<PermissionRow | null>;
  findPermissionByName(name: string): Promise<PermissionRow | null>;
  findAllPermissions(): Promise<PermissionRow[]>;
  updatePermission(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<void>;
  softDeletePermission(id: string): Promise<void>;

  // Role <-> Permission
  syncPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void>;
  findPermissionsByRoleId(roleId: string): Promise<PermissionRow[]>;

  // Model <-> Role
  assignRoleToModel(
    modelType: string,
    modelId: string,
    roleId: string,
  ): Promise<void>;
  revokeRoleFromModel(
    modelType: string,
    modelId: string,
    roleId: string,
  ): Promise<void>;
  findRolesByModel(modelType: string, modelId: string): Promise<RoleRow[]>;
  modelHasRole(
    modelType: string,
    modelId: string,
    roleName: string,
  ): Promise<boolean>;

  // Model <-> Permission
  assignPermissionToModel(
    modelType: string,
    modelId: string,
    permissionId: string,
  ): Promise<void>;
  revokePermissionFromModel(
    modelType: string,
    modelId: string,
    permissionId: string,
  ): Promise<void>;

  // Permission resolution
  resolveModelPermissions(
    modelType: string,
    modelId: string,
  ): Promise<PermissionRow[]>;
}
