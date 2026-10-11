import { createMockEventBus } from '../../../../../../test/helpers/mocks/event-bus.mock';
import { createMockPinoLogger } from '../../../../../../test/helpers/mocks/logger.mock';
import { createMockPasswordHasher } from '../../../../../../test/helpers/mocks/password-hasher.mock';
import { createMockPasswordResetTokenRepository } from '../../../../../../test/helpers/mocks/password-reset-token.mock';
import { InvalidResetTokenError } from '../../../domain/errors/invalid-reset-token.error';
import { WeakPasswordError } from '../../../domain/errors/weak-password.error';
import { PasswordChangedEvent } from '../../../domain/events/password-changed.event';
import { ResetPasswordCommand } from './reset-password.command';
import { ResetPasswordHandler } from './reset-password.handler';

describe('ResetPasswordHandler', () => {
  const resetTokens = createMockPasswordResetTokenRepository();
  const hasher = createMockPasswordHasher();
  const eventBus = createMockEventBus();
  const generator = {
    generate: jest.fn(),
    hash: jest.fn().mockReturnValue('token-hash'),
  };
  const handler = new ResetPasswordHandler(
    createMockPinoLogger() as any,
    resetTokens,
    generator,
    hasher,
    eventBus as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('redeems the hashed token with the new password hash and publishes the event', async () => {
    hasher.hash.mockResolvedValue('new-hash');
    resetTokens.redeem.mockResolvedValue({
      userId: 'u1',
      email: 'a@example.com',
    });

    await handler.execute(
      new ResetPasswordCommand('raw', 'newPassword1', 'vi'),
    );

    expect(generator.hash).toHaveBeenCalledWith('raw');
    expect(resetTokens.redeem).toHaveBeenCalledWith('token-hash', 'new-hash');
    const event = eventBus.publish.mock.calls[0][0] as PasswordChangedEvent;
    expect(event).toBeInstanceOf(PasswordChangedEvent);
    expect(event).toMatchObject({
      userId: 'u1',
      email: 'a@example.com',
      locale: 'vi',
      method: 'reset',
    });
  });

  it('throws InvalidResetTokenError when the token cannot be redeemed', async () => {
    resetTokens.redeem.mockResolvedValue(null);

    await expect(
      handler.execute(new ResetPasswordCommand('raw', 'newPassword1', 'en')),
    ).rejects.toThrow(InvalidResetTokenError);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it.each(['short', 'x'.repeat(129)])(
    'rejects password %# before touching the token',
    async (password) => {
      await expect(
        handler.execute(new ResetPasswordCommand('raw', password, 'en')),
      ).rejects.toThrow(WeakPasswordError);
      expect(resetTokens.redeem).not.toHaveBeenCalled();
    },
  );
});
