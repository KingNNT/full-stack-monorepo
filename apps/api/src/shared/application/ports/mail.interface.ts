import type { Locale } from '../../domain/locale';

export const MAIL_SENDER_TOKEN = Symbol('IMailSender');
export const MAIL_SERVICE_TOKEN = Symbol('IMailService');

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Transport: delivers an already-rendered message (SES, SMTP). */
export interface IMailSender {
  send(message: MailMessage): Promise<void>;
}

export interface MailTemplateParams {
  'password-reset': { resetUrl: string; ttlMinutes: number };
  'password-changed': {
    method: 'change' | 'reset';
    forgotPasswordUrl: string;
  };
}

export type MailTemplateName = keyof MailTemplateParams;

/** Renders a template in the given locale and sends it. */
export interface IMailService {
  sendTemplate<T extends MailTemplateName>(
    to: string,
    template: T,
    locale: Locale,
    params: MailTemplateParams[T],
  ): Promise<void>;
}
