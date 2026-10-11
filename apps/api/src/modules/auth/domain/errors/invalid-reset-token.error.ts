import { BadRequestException } from '@nestjs/common';

// One error for unknown, expired and used tokens: callers learn nothing more
export class InvalidResetTokenError extends BadRequestException {
  constructor() {
    super({
      message: 'Reset link is invalid or has expired',
      errorCode: 'INVALID_RESET_TOKEN',
    });
    this.name = 'InvalidResetTokenError';
  }
}
