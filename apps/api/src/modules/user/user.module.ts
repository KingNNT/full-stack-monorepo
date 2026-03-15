import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UNIT_OF_WORK_TOKEN } from '../../shared/application/unit-of-work.interface';
// Application handlers
import { CreateUserHandler } from './application/commands/create-user/create-user.handler';
import { UserCreatedDomainHandler } from './application/event-handlers/user-created.handler';
import { USER_READ_MODEL_REPOSITORY_TOKEN } from './application/ports/user-read-model.repository.interface';
// Domain tokens
import { USER_REPOSITORY_TOKEN } from './domain/repositories/user.repository.interface';

// Infrastructure
import { UserEventSerializer } from './infrastructure/persistence/event-store/event-serializer';
import { UserEventStoreRepository } from './infrastructure/persistence/event-store/user-event-store.repository';
import { UserReadModelRepository } from './infrastructure/persistence/read-model/user-read-model.repository';
import { UserUnitOfWork } from './infrastructure/unit-of-work/user-unit-of-work';

const CommandHandlers = [CreateUserHandler];
const EventHandlers = [UserCreatedDomainHandler];

@Module({
  imports: [CqrsModule],
  providers: [
    // Infrastructure services
    UserEventSerializer,
    UserEventStoreRepository,
    UserReadModelRepository,
    UserUnitOfWork,

    // Port -> Adapter bindings
    {
      provide: USER_REPOSITORY_TOKEN,
      useExisting: UserEventStoreRepository,
    },
    {
      provide: USER_READ_MODEL_REPOSITORY_TOKEN,
      useExisting: UserReadModelRepository,
    },
    {
      provide: UNIT_OF_WORK_TOKEN,
      useExisting: UserUnitOfWork,
    },

    // CQRS handlers
    ...CommandHandlers,
    ...EventHandlers,
  ],
})
export class UserModule {}
