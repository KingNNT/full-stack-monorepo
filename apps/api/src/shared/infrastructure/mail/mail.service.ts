import { Inject, Injectable } from '@nestjs/common';
import {
  type IMailSender,
  type IMailService,
  MAIL_SENDER_TOKEN,
  type MailTemplateName,
  type MailTemplateParams,
} from '../../application/ports/mail.interface';
import type { Locale } from '../../domain/locale';
import { renderTemplate } from './templates';

@Injectable()
export class MailService implements IMailService {
  constructor(
    @Inject(MAIL_SENDER_TOKEN) private readonly sender: IMailSender,
  ) {}

  async sendTemplate<T extends MailTemplateName>(
    to: string,
    template: T,
    locale: Locale,
    params: MailTemplateParams[T],
  ): Promise<void> {
    await this.sender.send({ to, ...renderTemplate(template, locale, params) });
  }
}
