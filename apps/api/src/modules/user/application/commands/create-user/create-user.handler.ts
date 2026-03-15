import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  type IUnitOfWork,
  UNIT_OF_WORK_TOKEN,
} from '../../../../../shared/application/unit-of-work.interface';
import { UserAggregate } from '../../../domain/aggregates/user.aggregate';
import { CreateUserCommand } from './create-user.command';
import type { CreateUserResult } from './create-user.result';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler
  implements ICommandHandler<CreateUserCommand, CreateUserResult>
{
  private readonly logger = new Logger(CreateUserHandler.name);

  constructor(
    @Inject(UNIT_OF_WORK_TOKEN)
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    this.logger.debug(
      `Creating user: email=${command.email}, username=${command.username}`,
    );

    const user = UserAggregate.create({
      email: command.email,
      username: command.username,
    });

    // Persist events to event store + update read model via UoW projection
    await this.unitOfWork.commit(user);

    this.logger.log(`User created: userId=${user.aggregateId}`);

    return { userId: user.aggregateId };
  }
}
