import type { Locale } from '../../../../../shared/domain/locale';

export class RequestPasswordResetCommand {
  constructor(
    public readonly email: string,
    public readonly locale: Locale,
  ) {}
}
