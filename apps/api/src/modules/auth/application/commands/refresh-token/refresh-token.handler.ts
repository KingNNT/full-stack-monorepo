import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  type ITokenService,
  TOKEN_SERVICE_TOKEN,
  type TokenPair,
} from '../../ports/token.service.interface';
import { RefreshTokenCommand } from './refresh-token.command';

// The refresh strategy has already verified the signature and token version.
@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler
  implements ICommandHandler<RefreshTokenCommand, TokenPair>
{
  constructor(
    @Inject(TOKEN_SERVICE_TOKEN)
    private readonly tokenService: ITokenService,
  ) {}

  execute(command: RefreshTokenCommand): Promise<TokenPair> {
    return this.tokenService.generateTokenPair(
      command.userId,
      command.tokenVersion,
    );
  }
}
