import { createAuthCredentialRecord } from '../../../../../../test/helpers/factories/auth.factory';
import { createMockAuthCredentialsRepository } from '../../../../../../test/helpers/mocks/auth-credentials.mock';
import { createMockEventBus } from '../../../../../../test/helpers/mocks/event-bus.mock';
import { createMockPinoLogger } from '../../../../../../test/helpers/mocks/logger.mock';
import { createMockPasswordResetTokenRepository } from '../../../../../../test/helpers/mocks/password-reset-token.mock';
import { PasswordResetRequestedEvent } from '../../../domain/events/password-reset-requested.event';
import { RequestPasswordResetCommand } from './request-password-reset.command';
import { RequestPasswordResetHandler } from './request-password-reset.handler';

describe('RequestPasswordResetHandler', () => {
  const credentials = createMockAuthCredentialsRepository();
  const resetTokens = createMockPasswordResetTokenRepository();
  const eventBus = createMockEventBus();
  const generator = {
    generate: jest
      .fn()
      .mockReturnValue({ raw: 'raw-token', hash: 'token-hash' }),
    hash: jest.fn(),
  };
  const config = { get: jest.fn().mockReturnValue('30') };
  const handler = new RequestPasswordResetHandler(
    createMockPinoLogger() as any,
    credentials,
    resetTokens,
    generator,
    eventBus as any,
    config as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    credentials.findByEmailOrUsername.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'u1', email: 'alice@example.com' }),
    );
    resetTokens.statsForUser.mockResolvedValue({
      issuedSince: 0,
      latestCreatedAt: null,
    });
  });

  it('normalizes the email before the lookup', async () => {
    await handler.execute(
      new RequestPasswordResetCommand('  Alice@Example.COM ', 'en'),
    );

    expect(credentials.findByEmailOrUsername).toHaveBeenCalledWith(
      'alice@example.com',
    );
  });

  it('issues a token that expires after the TTL and publishes the raw token', async () => {
    const before = Date.now();

    await handler.execute(
      new RequestPasswordResetCommand('alice@example.com', 'vi'),
    );

    const [userId, hash, expiresAt] = resetTokens.issue.mock.calls[0];
    expect(userId).toBe('u1');
    expect(hash).toBe('token-hash');
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * 60_000);
    const event = eventBus.publish.mock
      .calls[0][0] as PasswordResetRequestedEvent;
    expect(event).toBeInstanceOf(PasswordResetRequestedEvent);
    expect(event).toMatchObject({
      userId: 'u1',
      email: 'alice@example.com',
      rawToken: 'raw-token',
      locale: 'vi',
    });
  });

  it.each([
    [
      'unknown email',
      () => credentials.findByEmailOrUsername.mockResolvedValue(null),
    ],
    [
      'inactive account',
      () =>
        credentials.findByEmailOrUsername.mockResolvedValue(
          createAuthCredentialRecord({ isActive: false }),
        ),
    ],
    [
      'a token issued in the last minute',
      () =>
        resetTokens.statsForUser.mockResolvedValue({
          issuedSince: 1,
          latestCreatedAt: new Date(Date.now() - 10_000),
        }),
    ],
    [
      'five tokens in the last hour',
      () =>
        resetTokens.statsForUser.mockResolvedValue({
          issuedSince: 5,
          latestCreatedAt: new Date(Date.now() - 30 * 60_000),
        }),
    ],
  ])('silently does nothing for %s', async (_case, arrange) => {
    arrange();

    await expect(
      handler.execute(
        new RequestPasswordResetCommand('alice@example.com', 'en'),
      ),
    ).resolves.toBeUndefined();

    expect(resetTokens.issue).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('only looks up by email, never by username', async () => {
    credentials.findByEmailOrUsername.mockResolvedValue(
      createAuthCredentialRecord({
        email: 'other@example.com',
        username: 'alice',
      }),
    );

    await handler.execute(new RequestPasswordResetCommand('alice', 'en'));

    expect(resetTokens.issue).not.toHaveBeenCalled();
  });
});
