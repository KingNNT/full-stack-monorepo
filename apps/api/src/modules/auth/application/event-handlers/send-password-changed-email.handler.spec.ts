import { createMockPinoLogger } from '../../../../../test/helpers/mocks/logger.mock';
import { PasswordChangedEvent } from '../../domain/events/password-changed.event';
import { SendPasswordChangedEmailHandler } from './send-password-changed-email.handler';

describe('SendPasswordChangedEmailHandler', () => {
  const mail = { sendTemplate: jest.fn() };
  const failures = { add: jest.fn() };
  const metrics = { counter: jest.fn().mockReturnValue(failures) };
  const config = { get: jest.fn().mockReturnValue('https://app.test') };
  const logger = createMockPinoLogger();
  const handler = new SendPasswordChangedEmailHandler(
    logger as any,
    mail,
    metrics as any,
    config as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('sends the changed template with the method and forgot-password link', async () => {
    await handler.handle(
      new PasswordChangedEvent('u1', 'a@example.com', 'en', 'reset'),
    );

    expect(mail.sendTemplate).toHaveBeenCalledWith(
      'a@example.com',
      'password-changed',
      'en',
      {
        method: 'reset',
        forgotPasswordUrl: 'https://app.test/en/forgot-password',
      },
    );
  });

  it('swallows failures without logging the recipient', async () => {
    mail.sendTemplate.mockRejectedValueOnce(
      new Error('Message rejected: a@example.com is not verified'),
    );

    await expect(
      handler.handle(
        new PasswordChangedEvent('u1', 'a@example.com', 'en', 'change'),
      ),
    ).resolves.toBeUndefined();
    expect(failures.add).toHaveBeenCalledWith(1, {
      template: 'password-changed',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', errorName: 'Error' }),
      'Failed to send email',
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'a@example.com',
    );
  });
});
