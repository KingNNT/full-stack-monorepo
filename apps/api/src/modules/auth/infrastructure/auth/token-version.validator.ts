import { Inject, Injectable } from '@nestjs/common';
import {
  AUTH_CREDENTIALS_REPOSITORY_TOKEN,
  type IAuthCredentialsRepository,
} from '../../application/ports/auth-credentials.repository.interface';
import type { JwtPayload } from '../../application/ports/token.service.interface';
import { SessionRevokedError } from '../../domain/errors/session-revoked.error';

@Injectable()
export class TokenVersionValidator {
  constructor(
    @Inject(AUTH_CREDENTIALS_REPOSITORY_TOKEN)
    private readonly credentialsRepo: IAuthCredentialsRepository,
  ) {}

  async validate(payload: Partial<JwtPayload>): Promise<JwtPayload> {
    if (!payload.sub || typeof payload.tv !== 'number') {
      throw new SessionRevokedError();
    }
    const credential = await this.credentialsRepo.findByUserId(payload.sub);
    if (!credential?.isActive || credential.tokenVersion !== payload.tv) {
      throw new SessionRevokedError();
    }
    return payload as JwtPayload;
  }
}
