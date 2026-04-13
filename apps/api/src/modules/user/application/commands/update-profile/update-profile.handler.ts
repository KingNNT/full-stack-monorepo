import { ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import {
  type IUnitOfWork,
  UNIT_OF_WORK_TOKEN,
} from '../../../../../shared/application/unit-of-work.interface';
import {
  type IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../../domain/repositories/user.repository.interface';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { UpdateProfileCommand } from './update-profile.command';
import type { UpdateProfileResult } from './update-profile.result';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler
  implements ICommandHandler<UpdateProfileCommand, UpdateProfileResult>
{
  constructor(
    @InjectPinoLogger(UpdateProfileHandler.name)
    private readonly logger: PinoLogger,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepo: IUserRepository,
    @Inject(UNIT_OF_WORK_TOKEN)
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<UpdateProfileResult> {
    this.logger.info(
      { userId: command.userId, username: command.username },
      'Update profile attempt',
    );

    const userId = UserId.fromString(command.userId);
    const aggregate = await this.userRepo.findById(userId);
    if (!aggregate) {
      throw new NotFoundException('User not found');
    }

    aggregate.updateProfile({ username: command.username });

    try {
      await this.unitOfWork.commit(aggregate);
    } catch (err) {
      if (
        err instanceof Error &&
        /duplicate key|unique/i.test(err.message) &&
        /username/i.test(err.message)
      ) {
        throw new ConflictException('Username already in use');
      }
      throw err;
    }

    this.logger.info({ userId: command.userId }, 'Profile updated');

    return {
      userId: aggregate.aggregateId,
      username: aggregate.username.value,
    };
  }
}
