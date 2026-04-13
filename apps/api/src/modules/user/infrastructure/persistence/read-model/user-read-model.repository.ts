import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { DomainEventBase } from '../../../../../shared/domain/domain-event.base';
import { AuditableTableService } from '../../../../../shared/infrastructure/database/auditable-table.service';
import { DrizzleService } from '../../../../../shared/infrastructure/database/drizzle.service';
import { usersTable } from '../../../../../shared/infrastructure/database/schema/users.table';
import type {
  IUserReadModelRepository,
  UserReadRecord,
} from '../../../application/ports/user-read-model.repository.interface';
import { UserCreatedEvent } from '../../../domain/events/user-created.event';
import { UserProfileUpdatedEvent } from '../../../domain/events/user-profile-updated.event';

@Injectable()
export class UserReadModelRepository implements IUserReadModelRepository {
  constructor(
    private readonly audit: AuditableTableService,
    private readonly drizzle: DrizzleService,
  ) {}

  async applyProjection(events: ReadonlyArray<DomainEventBase>): Promise<void> {
    for (const event of events) {
      if (event instanceof UserCreatedEvent) {
        await this.audit.insert(usersTable, {
          id: event.payload.userId,
          email: event.payload.email,
          username: event.payload.username,
          createdAt: event.payload.createdAt,
          isActive: true,
        });
      } else if (event instanceof UserProfileUpdatedEvent) {
        await this.audit.update(
          usersTable,
          and(
            eq(usersTable.id, event.payload.userId),
            isNull(usersTable.deletedAt),
          )!,
          { username: event.payload.username },
        );
      }
    }
  }

  async findById(userId: string): Promise<UserReadRecord | null> {
    const results = await this.drizzle.db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        username: usersTable.username,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)))
      .limit(1);

    return results[0] ?? null;
  }
}
