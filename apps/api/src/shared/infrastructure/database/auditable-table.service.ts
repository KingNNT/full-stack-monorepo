import { Injectable } from '@nestjs/common';
import { and, isNull, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable, TableConfig } from 'drizzle-orm/pg-core';
import { ClsService } from 'nestjs-cls';
import { CLS_USER_ID } from '../cls/cls.constants';
import { DrizzleService, type DrizzleTransaction } from './drizzle.service';

type AuditableColumns = {
  createdBy: PgColumn;
  updatedBy: PgColumn;
  deletedAt: PgColumn;
  deletedBy: PgColumn;
};

type AuditableTable = PgTable<TableConfig> & {
  [K in keyof AuditableColumns]: PgColumn;
};

type Db = DrizzleService['db'] | DrizzleTransaction;

@Injectable()
export class AuditableTableService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cls: ClsService,
  ) {}

  private currentUserId(): string | null {
    return this.cls.isActive() ? (this.cls.get(CLS_USER_ID) ?? null) : null;
  }

  private getDb(tx?: DrizzleTransaction): Db {
    return tx ?? this.drizzle.db;
  }

  async insert<T extends AuditableTable>(
    table: T,
    values: Record<string, unknown>,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const userId = this.currentUserId();
    await this.getDb(tx)
      .insert(table)
      .values({
        ...values,
        createdBy: userId,
        updatedBy: userId,
      } as T['$inferInsert']);
  }

  async update<T extends AuditableTable>(
    table: T,
    where: SQL,
    values: Record<string, unknown>,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const userId = this.currentUserId();
    await this.getDb(tx)
      .update(table)
      .set({
        ...values,
        updatedBy: userId,
      } as Partial<T['$inferInsert']>)
      .where(where);
  }

  async softDelete<T extends AuditableTable>(
    table: T,
    where: SQL,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const userId = this.currentUserId();
    const now = new Date();
    await this.getDb(tx)
      .update(table)
      .set({
        deletedAt: now,
        deletedBy: userId,
        updatedBy: userId,
      } as Partial<T['$inferInsert']>)
      .where(and(where, isNull(table.deletedAt)));
  }

  notDeleted<T extends AuditableTable>(table: T): SQL {
    return isNull(table.deletedAt);
  }
}
