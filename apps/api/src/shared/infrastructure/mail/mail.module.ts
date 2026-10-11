import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type IMailSender,
  MAIL_SENDER_TOKEN,
  MAIL_SERVICE_TOKEN,
} from '../../application/ports/mail.interface';
import { MailService } from './mail.service';
import { SesMailSender } from './ses-mail-sender';
import { SmtpMailSender } from './smtp-mail-sender';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_SENDER_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): IMailSender => {
        const from = config.get<string>(
          'MAIL_FROM',
          'App <no-reply@localhost>',
        );
        if (config.get<string>('MAIL_TRANSPORT', 'smtp') === 'ses') {
          return new SesMailSender({
            region: config.get<string>('AWS_REGION'),
            from,
            configurationSet: config.get<string>('SES_CONFIGURATION_SET'),
          });
        }
        return new SmtpMailSender({
          host: config.get<string>('SMTP_HOST', 'localhost'),
          port: Number(config.get<string>('SMTP_PORT', '1025')),
          from,
        });
      },
    },
    MailService,
    { provide: MAIL_SERVICE_TOKEN, useExisting: MailService },
  ],
  exports: [MAIL_SENDER_TOKEN, MAIL_SERVICE_TOKEN],
})
export class MailModule {}
