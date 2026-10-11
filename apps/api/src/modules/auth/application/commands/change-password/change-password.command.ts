import type { Locale } from '../../../../../shared/domain/locale';

export class ChangePasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly oldPassword: string,
    public readonly newPassword: string,
    public readonly locale: Locale = 'en',
  ) {}
}
