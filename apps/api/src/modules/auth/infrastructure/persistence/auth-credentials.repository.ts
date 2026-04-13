import { Injectable } from '@nestjs/common';
import { and, eq, isNull, or } from 'drizzle-orm';
import { AuditableTableService } from '../../../../shared/infrastructure/database/auditable-table.service';
import { DrizzleService } from '../../../../shared/infrastructure/database/drizzle.service';
import { authCredentialsTable } from '../../../../shared/infrastructure/database/schema/auth-credentials.table';
import type {
  AuthCredentialRecord,
  IAuthCredentialsRepository,
} from '../../application/ports/auth-credentials.repository.interface';

@Injectable()
export class AuthCredentialsRepository implements IAuthCredentialsRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditableTableService,
  ) {}

  async findByEmailOrUsername(
    identifier: string,
  ): Promise<AuthCredentialRecord | null> {
    const results = await this.drizzle.db
      .select({
        userId: authCredentialsTable.userId,
        email: authCredentialsTable.email,
        username: authCredentialsTable.username,
        passwordHash: authCredentialsTable.passwordHash,
        isActive: authCredentialsTable.isActive,
      })
      .from(authCredentialsTable)
      .where(
        and(
          or(
            eq(authCredentialsTable.email, identifier.toLowerCase()),
            eq(authCredentialsTable.username, identifier),
          ),
          isNull(authCredentialsTable.deletedAt),
        ),
      )
      .limit(1);

    return results[0] ?? null;
  }

  async create(
    userId: string,
    email: string,
    username: string,
    passwordHash: string,
  ): Promise<void> {
    await this.audit.insert(authCredentialsTable, {
      userId,
      email: email.toLowerCase().trim(),
      username,
      passwordHash,
      isActive: true,
    });
  }

  async updateLastLogin(userId: string, at: Date): Promise<void> {
    await this.audit.update(
      authCredentialsTable,
      and(
        eq(authCredentialsTable.userId, userId),
        isNull(authCredentialsTable.deletedAt),
      )!,
      { lastLoginAt: at },
    );
  }

  async findByUserId(userId: string): Promise<AuthCredentialRecord | null> {
    const results = await this.drizzle.db
      .select({
        userId: authCredentialsTable.userId,
        email: authCredentialsTable.email,
        username: authCredentialsTable.username,
        passwordHash: authCredentialsTable.passwordHash,
        isActive: authCredentialsTable.isActive,
      })
      .from(authCredentialsTable)
      .where(
        and(
          eq(authCredentialsTable.userId, userId),
          isNull(authCredentialsTable.deletedAt),
        ),
      )
      .limit(1);

    return results[0] ?? null;
  }

  async updateUsername(userId: string, username: string): Promise<void> {
    await this.audit.update(
      authCredentialsTable,
      and(
        eq(authCredentialsTable.userId, userId),
        isNull(authCredentialsTable.deletedAt),
      )!,
      { username },
    );
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.audit.update(
      authCredentialsTable,
      and(
        eq(authCredentialsTable.userId, userId),
        isNull(authCredentialsTable.deletedAt),
      )!,
      { passwordHash },
    );
  }
}
