import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import type { Counter } from '@opentelemetry/api';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import {
  type IMailService,
  MAIL_SERVICE_TOKEN,
} from '../../../../shared/application/ports/mail.interface';
import { MetricsService } from '../../../../shared/infrastructure/metrics/metrics.service';
import { PasswordChangedEvent } from '../../domain/events/password-changed.event';

@EventsHandler(PasswordChangedEvent)
export class SendPasswordChangedEmailHandler
  implements IEventHandler<PasswordChangedEvent>
{
  private readonly failures: Counter;

  constructor(
    @InjectPinoLogger(SendPasswordChangedEmailHandler.name)
    private readonly logger: PinoLogger,
    @Inject(MAIL_SERVICE_TOKEN)
    private readonly mail: IMailService,
    metrics: MetricsService,
    private readonly config: ConfigService,
  ) {
    this.failures = metrics.counter(
      'mail_send_failures_total',
      'Emails that could not be handed to the mail transport',
    );
  }

  async handle(event: PasswordChangedEvent): Promise<void> {
    const webAppUrl = this.config.get<string>(
      'WEB_APP_URL',
      'http://localhost:3000',
    );
    try {
      await this.mail.sendTemplate(
        event.email,
        'password-changed',
        event.locale,
        {
          method: event.method,
          forgotPasswordUrl: `${webAppUrl}/${event.locale}/forgot-password`,
        },
      );
    } catch (err) {
      this.failures.add(1, { template: 'password-changed' });
      // Never log err.message: SES/SMTP errors can embed the recipient.
      const statusCode = (err as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      this.logger.error(
        {
          userId: event.userId,
          template: 'password-changed',
          errorName: (err as Error)?.name,
          ...(statusCode !== undefined && { statusCode }),
        },
        'Failed to send email',
      );
    }
  }
}
