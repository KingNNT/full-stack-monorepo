import type { Locale } from '../../../../../shared/domain/locale';

export class ResetPasswordCommand {
  constructor(
    public readonly token: string,
    public readonly newPassword: string,
    public readonly locale: Locale,
  ) {}
}
