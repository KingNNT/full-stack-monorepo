import { createMockPinoLogger } from '../../../../../test/helpers/mocks/logger.mock';
import { PasswordResetRequestedEvent } from '../../domain/events/password-reset-requested.event';
import { SendPasswordResetEmailHandler } from './send-password-reset-email.handler';

describe('SendPasswordResetEmailHandler', () => {
  const mail = { sendTemplate: jest.fn() };
  const failures = { add: jest.fn() };
  const metrics = { counter: jest.fn().mockReturnValue(failures) };
  const logger = createMockPinoLogger();
  const config = {
    get: jest.fn(
      (key: string, fallback?: string) =>
        ({ WEB_APP_URL: 'https://app.test', PASSWORD_RESET_TTL_MINUTES: '30' })[
          key
        ] ?? fallback,
    ),
  };
  const handler = new SendPasswordResetEmailHandler(
    logger as any,
    mail,
    metrics as any,
    config as any,
  );
  const event = new PasswordResetRequestedEvent(
    'u1',
    'a@example.com',
    'raw+/tok',
    'vi',
  );

  beforeEach(() => jest.clearAllMocks());

  it('sends the reset template with a locale-prefixed, encoded link', async () => {
    await handler.handle(event);

    expect(mail.sendTemplate).toHaveBeenCalledWith(
      'a@example.com',
      'password-reset',
      'vi',
      {
        resetUrl: 'https://app.test/vi/reset-password?token=raw%2B%2Ftok',
        ttlMinutes: 30,
      },
    );
  });

  it('logs and counts failures without throwing or leaking the email', async () => {
    const err = Object.assign(
      new Error('Message rejected: a@example.com is not verified'),
      { name: 'MessageRejected', $metadata: { httpStatusCode: 400 } },
    );
    mail.sendTemplate.mockRejectedValueOnce(err);

    await expect(handler.handle(event)).resolves.toBeUndefined();

    expect(failures.add).toHaveBeenCalledWith(1, {
      template: 'password-reset',
    });
    expect(logger.error).toHaveBeenCalledWith(
      {
        userId: 'u1',
        template: 'password-reset',
        errorName: 'MessageRejected',
        statusCode: 400,
      },
      'Failed to send email',
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'a@example.com',
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('raw+/tok');
  });
});
