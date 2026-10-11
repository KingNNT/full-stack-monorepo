import type { Locale } from '../../../../shared/domain/locale';

export class PasswordChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly locale: Locale,
    public readonly method: 'change' | 'reset',
  ) {}
}
