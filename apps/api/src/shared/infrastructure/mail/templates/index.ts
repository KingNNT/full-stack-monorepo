import type {
  MailMessage,
  MailTemplateName,
  MailTemplateParams,
} from '../../../application/ports/mail.interface';
import { type Locale, toLocale } from '../../../domain/locale';
import { passwordChanged } from './password-changed';
import { passwordReset } from './password-reset';

export type RenderedMail = Omit<MailMessage, 'to'>;

const RENDERERS: {
  [T in MailTemplateName]: (
    locale: Locale,
    params: MailTemplateParams[T],
  ) => RenderedMail;
} = {
  'password-reset': passwordReset,
  'password-changed': passwordChanged,
};

export function renderTemplate<T extends MailTemplateName>(
  template: T,
  locale: string,
  params: MailTemplateParams[T],
): RenderedMail {
  return RENDERERS[template](toLocale(locale), params);
}
