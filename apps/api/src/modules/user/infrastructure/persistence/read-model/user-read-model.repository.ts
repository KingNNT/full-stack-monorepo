import { Injectable } from '@nestjs/common';
import type { DomainEventBase } from '../../../../../shared/domain/domain-event.base';
import { AuditableTableService } from '../../../../../shared/infrastructure/database/auditable-table.service';
import { usersTable } from '../../../../../shared/infrastructure/database/schema/users.table';
import type { IUserReadModelRepository } from '../../../application/ports/user-read-model.repository.interface';
import { UserCreatedEvent } from '../../../domain/events/user-created.event';

@Injectable()
export class UserReadModelRepository implements IUserReadModelRepository {
  constructor(private readonly audit: AuditableTableService) {}

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
      }
    }
  }
}
