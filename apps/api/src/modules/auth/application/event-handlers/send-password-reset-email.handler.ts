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
import { PasswordResetRequestedEvent } from '../../domain/events/password-reset-requested.event';

@EventsHandler(PasswordResetRequestedEvent)
export class SendPasswordResetEmailHandler
  implements IEventHandler<PasswordResetRequestedEvent>
{
  private readonly failures: Counter;

  constructor(
    @InjectPinoLogger(SendPasswordResetEmailHandler.name)
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

  async handle(event: PasswordResetRequestedEvent): Promise<void> {
    const webAppUrl = this.config.get<string>(
      'WEB_APP_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${webAppUrl}/${event.locale}/reset-password?token=${encodeURIComponent(event.rawToken)}`;
    try {
      await this.mail.sendTemplate(
        event.email,
        'password-reset',
        event.locale,
        {
          resetUrl,
          ttlMinutes: Number(
            this.config.get('PASSWORD_RESET_TTL_MINUTES', '30'),
          ),
        },
      );
    } catch (err) {
      this.failures.add(1, { template: 'password-reset' });
      this.logger.error(
        {
          userId: event.userId,
          template: 'password-reset',
          err: (err as Error).message,
        },
        'Failed to send email',
      );
    }
  }
}
