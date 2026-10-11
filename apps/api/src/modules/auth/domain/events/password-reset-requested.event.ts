import type { Locale } from '../../../../shared/domain/locale';

/** Carries the raw token to the mail handler only; never persisted or logged. */
export class PasswordResetRequestedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly rawToken: string,
    public readonly locale: Locale,
  ) {}
}
