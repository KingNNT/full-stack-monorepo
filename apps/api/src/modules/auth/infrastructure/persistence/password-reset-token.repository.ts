import { Injectable } from '@nestjs/common';
import { and, count, eq, gt, gte, isNull, max, ne, sql } from 'drizzle-orm';
import { AuditableTableService } from '../../../../shared/infrastructure/database/auditable-table.service';
import { DrizzleService } from '../../../../shared/infrastructure/database/drizzle.service';
import { authCredentialsTable } from '../../../../shared/infrastructure/database/schema/auth-credentials.table';
import { passwordResetTokensTable as tokens } from '../../../../shared/infrastructure/database/schema/password-reset-tokens.table';
import type {
  IPasswordResetTokenRepository,
  RedeemedReset,
  ResetTokenStats,
} from '../../application/ports/password-reset-token.repository.interface';

@Injectable()
export class PasswordResetTokenRepository
  implements IPasswordResetTokenRepository
{
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditableTableService,
  ) {}

  async statsForUser(userId: string, since: Date): Promise<ResetTokenStats> {
    const [row] = await this.drizzle.db
      .select({ issued: count(), latest: max(tokens.createdAt) })
      .from(tokens)
      .where(
        and(
          eq(tokens.userId, userId),
          gte(tokens.createdAt, since),
          isNull(tokens.deletedAt),
        ),
      );
    return {
      issuedSince: Number(row.issued),
      latestCreatedAt: row.latest ?? null,
    };
  }

  async issue(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.drizzle.transaction(async (tx) => {
      // Serialises concurrent issues for the same user
      await tx
        .select({ userId: authCredentialsTable.userId })
        .from(authCredentialsTable)
        .where(eq(authCredentialsTable.userId, userId))
        .for('update');
      await this.audit.update(
        tokens,
        and(
          eq(tokens.userId, userId),
          isNull(tokens.usedAt),
          isNull(tokens.deletedAt),
        )!,
        { usedAt: new Date() },
        tx,
      );
      await this.audit.insert(tokens, { userId, tokenHash, expiresAt }, tx);
    });
  }

  async supersedeAllForUser(userId: string): Promise<void> {
    await this.drizzle.transaction(async (tx) => {
      // Same lock order as issue() and redeem(): credentials -> tokens
      await tx
        .select({ userId: authCredentialsTable.userId })
        .from(authCredentialsTable)
        .where(eq(authCredentialsTable.userId, userId))
        .for('update');
      await this.audit.update(
        tokens,
        and(
          eq(tokens.userId, userId),
          isNull(tokens.usedAt),
          isNull(tokens.deletedAt),
        )!,
        { usedAt: new Date() },
        tx,
      );
    });
  }

  async redeem(
    tokenHash: string,
    newPasswordHash: string,
  ): Promise<RedeemedReset | null> {
    return this.drizzle.transaction(async (tx) => {
      const now = new Date();
      // Lock order is credentials -> tokens everywhere (see issue())
      const [candidate] = await tx
        .select({ userId: tokens.userId })
        .from(tokens)
        .where(and(eq(tokens.tokenHash, tokenHash), isNull(tokens.deletedAt)));
      if (!candidate) return null;
      const [account] = await tx
        .select({ isActive: authCredentialsTable.isActive })
        .from(authCredentialsTable)
        .where(
          and(
            eq(authCredentialsTable.userId, candidate.userId),
            isNull(authCredentialsTable.deletedAt),
          ),
        )
        .for('update');
      // Inactive or deleted accounts cannot be reset; leave the token unclaimed
      if (!account?.isActive) return null;
      // Conditional UPDATE claims the token: a concurrent redeem finds used_at set
      const [claimed] = await tx
        .update(tokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(tokens.tokenHash, tokenHash),
            eq(tokens.userId, candidate.userId),
            isNull(tokens.usedAt),
            gt(tokens.expiresAt, now),
            isNull(tokens.deletedAt),
          ),
        )
        .returning({ id: tokens.id, userId: tokens.userId });
      if (!claimed) return null;

      const credentialWhere = and(
        eq(authCredentialsTable.userId, claimed.userId),
        isNull(authCredentialsTable.deletedAt),
      )!;
      await this.audit.update(
        authCredentialsTable,
        credentialWhere,
        {
          passwordHash: newPasswordHash,
          tokenVersion: sql`${authCredentialsTable.tokenVersion} + 1`,
        },
        tx,
      );
      const [credential] = await tx
        .select({ email: authCredentialsTable.email })
        .from(authCredentialsTable)
        .where(credentialWhere);
      if (!credential) return null;

      await tx
        .update(tokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(tokens.userId, claimed.userId),
            ne(tokens.id, claimed.id),
            isNull(tokens.usedAt),
            isNull(tokens.deletedAt),
          ),
        );

      return { userId: claimed.userId, email: credential.email };
    });
  }
}
