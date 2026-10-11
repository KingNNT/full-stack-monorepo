import { UnauthorizedException } from '@nestjs/common';

export class SessionRevokedError extends UnauthorizedException {
  constructor() {
    super({
      message: 'Session is no longer valid',
      errorCode: 'SESSION_REVOKED',
    });
    this.name = 'SessionRevokedError';
  }
}
