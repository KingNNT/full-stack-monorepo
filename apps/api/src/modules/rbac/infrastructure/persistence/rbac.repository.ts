import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { AuditableTableService } from '../../../../shared/infrastructure/database/auditable-table.service';
import { DrizzleService } from '../../../../shared/infrastructure/database/drizzle.service';
import {
  modelHasPermissionsTable,
  modelHasRolesTable,
  permissionsTable,
  roleHasPermissionsTable,
  rolesTable,
} from '../../../../shared/infrastructure/database/schema/index';
import type { PermissionRow } from '../../../../shared/infrastructure/database/schema/permissions.table';
import type { RoleRow } from '../../../../shared/infrastructure/database/schema/roles.table';
import type { IRbacRepository } from '../../application/ports/rbac.repository.interface';

@Injectable()
export class RbacRepository implements IRbacRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditable: AuditableTableService,
  ) {}

  // ── Roles ───────────────────────────────────

  async createRole(name: string, description?: string): Promise<RoleRow> {
    const [role] = await this.drizzle.db
      .insert(rolesTable)
      .values({ name, description })
      .returning();
    return role;
  }

  async findRoleById(id: string): Promise<RoleRow | null> {
    const results = await this.drizzle.db
      .select()
      .from(rolesTable)
      .where(and(eq(rolesTable.id, id), isNull(rolesTable.deletedAt)))
      .limit(1);
    return results[0] ?? null;
  }

  async findRoleByName(name: string): Promise<RoleRow | null> {
    const results = await this.drizzle.db
      .select()
      .from(rolesTable)
      .where(and(eq(rolesTable.name, name), isNull(rolesTable.deletedAt)))
      .limit(1);
    return results[0] ?? null;
  }

  async findAllRoles(): Promise<RoleRow[]> {
    return this.drizzle.db
      .select()
      .from(rolesTable)
      .where(isNull(rolesTable.deletedAt));
  }

  async updateRole(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<void> {
    await this.auditable.update(
      rolesTable,
      and(eq(rolesTable.id, id), isNull(rolesTable.deletedAt))!,
      data,
    );
  }

  async softDeleteRole(id: string): Promise<void> {
    await this.auditable.softDelete(rolesTable, eq(rolesTable.id, id));
  }

  // ── Permissions ─────────────────────────────

  async createPermission(
    name: string,
    description?: string,
  ): Promise<PermissionRow> {
    const [permission] = await this.drizzle.db
      .insert(permissionsTable)
      .values({ name, description })
      .returning();
    return permission;
  }

  async findPermissionById(id: string): Promise<PermissionRow | null> {
    const results = await this.drizzle.db
      .select()
      .from(permissionsTable)
      .where(
        and(eq(permissionsTable.id, id), isNull(permissionsTable.deletedAt)),
      )
      .limit(1);
    return results[0] ?? null;
  }

  async findPermissionByName(name: string): Promise<PermissionRow | null> {
    const results = await this.drizzle.db
      .select()
      .from(permissionsTable)
      .where(
        and(
          eq(permissionsTable.name, name),
          isNull(permissionsTable.deletedAt),
        ),
      )
      .limit(1);
    return results[0] ?? null;
  }

  async findAllPermissions(): Promise<PermissionRow[]> {
    return this.drizzle.db
      .select()
      .from(permissionsTable)
      .where(isNull(permissionsTable.deletedAt));
  }

  async updatePermission(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<void> {
    await this.auditable.update(
      permissionsTable,
      and(eq(permissionsTable.id, id), isNull(permissionsTable.deletedAt))!,
      data,
    );
  }

  async softDeletePermission(id: string): Promise<void> {
    await this.auditable.softDelete(
      permissionsTable,
      eq(permissionsTable.id, id),
    );
  }

  // ── Role <-> Permission ─────────────────────

  async syncPermissionsToRole(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    await this.drizzle.transaction(async (tx) => {
      await tx
        .delete(roleHasPermissionsTable)
        .where(eq(roleHasPermissionsTable.roleId, roleId));

      if (permissionIds.length === 0) return;

      await tx.insert(roleHasPermissionsTable).values(
        permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      );
    });
  }

  async findPermissionsByRoleId(roleId: string): Promise<PermissionRow[]> {
    const results = await this.drizzle.db
      .select({
        id: permissionsTable.id,
        name: permissionsTable.name,
        description: permissionsTable.description,
        isActive: permissionsTable.isActive,
        createdAt: permissionsTable.createdAt,
        createdBy: permissionsTable.createdBy,
        updatedAt: permissionsTable.updatedAt,
        updatedBy: permissionsTable.updatedBy,
        deletedAt: permissionsTable.deletedAt,
        deletedBy: permissionsTable.deletedBy,
      })
      .from(roleHasPermissionsTable)
      .innerJoin(
        permissionsTable,
        eq(roleHasPermissionsTable.permissionId, permissionsTable.id),
      )
      .where(
        and(
          eq(roleHasPermissionsTable.roleId, roleId),
          isNull(permissionsTable.deletedAt),
        ),
      );
    return results;
  }

  // ── Model <-> Role ──────────────────────────

  async assignRoleToModel(
    modelType: string,
    modelId: string,
    roleId: string,
  ): Promise<void> {
    await this.drizzle.db
      .insert(modelHasRolesTable)
      .values({ modelType, modelId, roleId })
      .onConflictDoNothing();
  }

  async revokeRoleFromModel(
    modelType: string,
    modelId: string,
    roleId: string,
  ): Promise<void> {
    await this.drizzle.db
      .delete(modelHasRolesTable)
      .where(
        and(
          eq(modelHasRolesTable.modelType, modelType),
          eq(modelHasRolesTable.modelId, modelId),
          eq(modelHasRolesTable.roleId, roleId),
        ),
      );
  }

  async findRolesByModel(
    modelType: string,
    modelId: string,
  ): Promise<RoleRow[]> {
    const results = await this.drizzle.db
      .select({
        id: rolesTable.id,
        name: rolesTable.name,
        description: rolesTable.description,
        isActive: rolesTable.isActive,
        createdAt: rolesTable.createdAt,
        createdBy: rolesTable.createdBy,
        updatedAt: rolesTable.updatedAt,
        updatedBy: rolesTable.updatedBy,
        deletedAt: rolesTable.deletedAt,
        deletedBy: rolesTable.deletedBy,
      })
      .from(modelHasRolesTable)
      .innerJoin(rolesTable, eq(modelHasRolesTable.roleId, rolesTable.id))
      .where(
        and(
          eq(modelHasRolesTable.modelType, modelType),
          eq(modelHasRolesTable.modelId, modelId),
          isNull(rolesTable.deletedAt),
        ),
      );
    return results;
  }

  async modelHasRole(
    modelType: string,
    modelId: string,
    roleName: string,
  ): Promise<boolean> {
    const results = await this.drizzle.db
      .select({ id: rolesTable.id })
      .from(modelHasRolesTable)
      .innerJoin(rolesTable, eq(modelHasRolesTable.roleId, rolesTable.id))
      .where(
        and(
          eq(modelHasRolesTable.modelType, modelType),
          eq(modelHasRolesTable.modelId, modelId),
          eq(rolesTable.name, roleName),
          isNull(rolesTable.deletedAt),
        ),
      )
      .limit(1);
    return results.length > 0;
  }

  // ── Model <-> Permission ────────────────────

  async assignPermissionToModel(
    modelType: string,
    modelId: string,
    permissionId: string,
  ): Promise<void> {
    await this.drizzle.db
      .insert(modelHasPermissionsTable)
      .values({ modelType, modelId, permissionId })
      .onConflictDoNothing();
  }

  async revokePermissionFromModel(
    modelType: string,
    modelId: string,
    permissionId: string,
  ): Promise<void> {
    await this.drizzle.db
      .delete(modelHasPermissionsTable)
      .where(
        and(
          eq(modelHasPermissionsTable.modelType, modelType),
          eq(modelHasPermissionsTable.modelId, modelId),
          eq(modelHasPermissionsTable.permissionId, permissionId),
        ),
      );
  }

  // ── Permission resolution ───────────────────

  async resolveModelPermissions(
    modelType: string,
    modelId: string,
  ): Promise<PermissionRow[]> {
    // 1. Permissions via roles
    const roleBasedPerms = await this.drizzle.db
      .select({
        id: permissionsTable.id,
        name: permissionsTable.name,
        description: permissionsTable.description,
        isActive: permissionsTable.isActive,
        createdAt: permissionsTable.createdAt,
        createdBy: permissionsTable.createdBy,
        updatedAt: permissionsTable.updatedAt,
        updatedBy: permissionsTable.updatedBy,
        deletedAt: permissionsTable.deletedAt,
        deletedBy: permissionsTable.deletedBy,
      })
      .from(modelHasRolesTable)
      .innerJoin(
        roleHasPermissionsTable,
        eq(modelHasRolesTable.roleId, roleHasPermissionsTable.roleId),
      )
      .innerJoin(
        permissionsTable,
        eq(roleHasPermissionsTable.permissionId, permissionsTable.id),
      )
      .innerJoin(rolesTable, eq(modelHasRolesTable.roleId, rolesTable.id))
      .where(
        and(
          eq(modelHasRolesTable.modelType, modelType),
          eq(modelHasRolesTable.modelId, modelId),
          isNull(rolesTable.deletedAt),
          eq(rolesTable.isActive, true),
          isNull(permissionsTable.deletedAt),
          eq(permissionsTable.isActive, true),
        ),
      );

    // 2. Direct permissions
    const directPerms = await this.drizzle.db
      .select({
        id: permissionsTable.id,
        name: permissionsTable.name,
        description: permissionsTable.description,
        isActive: permissionsTable.isActive,
        createdAt: permissionsTable.createdAt,
        createdBy: permissionsTable.createdBy,
        updatedAt: permissionsTable.updatedAt,
        updatedBy: permissionsTable.updatedBy,
        deletedAt: permissionsTable.deletedAt,
        deletedBy: permissionsTable.deletedBy,
      })
      .from(modelHasPermissionsTable)
      .innerJoin(
        permissionsTable,
        eq(modelHasPermissionsTable.permissionId, permissionsTable.id),
      )
      .where(
        and(
          eq(modelHasPermissionsTable.modelType, modelType),
          eq(modelHasPermissionsTable.modelId, modelId),
          isNull(permissionsTable.deletedAt),
          eq(permissionsTable.isActive, true),
        ),
      );

    // Deduplicate by permission id
    const seen = new Set<string>();
    const merged: PermissionRow[] = [];
    for (const p of [...roleBasedPerms, ...directPerms]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    }
    return merged;
  }
}
