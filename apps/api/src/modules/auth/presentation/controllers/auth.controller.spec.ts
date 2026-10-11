import { createMockCommandBus } from '../../../../../test/helpers/mocks/command-bus.mock';
import { LoginCommand } from '../../application/commands/login/login.command';
import { RefreshTokenCommand } from '../../application/commands/refresh-token/refresh-token.command';
import { RegisterCommand } from '../../application/commands/register/register.command';
import { RequestPasswordResetCommand } from '../../application/commands/request-password-reset/request-password-reset.command';
import { ResetPasswordCommand } from '../../application/commands/reset-password/reset-password.command';
import { LoginResponseDto } from '../dtos/login.response.dto';
import { RegisterResponseDto } from '../dtos/register.response.dto';
import { TokenPairResponseDto } from '../dtos/token-pair.response.dto';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let mockCommandBus: jest.Mocked<
    Pick<import('@nestjs/cqrs').CommandBus, 'execute'>
  >;

  beforeEach(() => {
    mockCommandBus = createMockCommandBus();
    controller = new AuthController(mockCommandBus as any);
  });

  describe('register()', () => {
    it('dispatches RegisterCommand and returns userId', async () => {
      mockCommandBus.execute.mockResolvedValue({ userId: 'new-user-id' });

      const result = await controller.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'securePassword123',
      });

      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      const dispatched = mockCommandBus.execute.mock
        .calls[0][0] as RegisterCommand;
      expect(dispatched).toBeInstanceOf(RegisterCommand);
      expect(dispatched.email).toBe('test@example.com');
      expect(dispatched.username).toBe('testuser');
      expect(dispatched.password).toBe('securePassword123');
      expect(result).toBeInstanceOf(RegisterResponseDto);
      expect(result.userId).toBe('new-user-id');
    });
  });

  describe('login()', () => {
    it('dispatches LoginCommand and returns token pair', async () => {
      mockCommandBus.execute.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await controller.login({
        identifier: 'test@example.com',
        password: 'securePassword123',
      });

      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      const dispatched = mockCommandBus.execute.mock
        .calls[0][0] as LoginCommand;
      expect(dispatched).toBeInstanceOf(LoginCommand);
      expect(dispatched.identifier).toBe('test@example.com');
      expect(dispatched.password).toBe('securePassword123');
      expect(result).toBeInstanceOf(LoginResponseDto);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  describe('refresh()', () => {
    it('dispatches RefreshTokenCommand with the token claims', async () => {
      mockCommandBus.execute.mockResolvedValue({
        accessToken: 'a2',
        refreshToken: 'r2',
      });

      const result = await controller.refresh({ sub: 'u1', tv: 2 });

      const dispatched = mockCommandBus.execute.mock
        .calls[0][0] as RefreshTokenCommand;
      expect(dispatched).toBeInstanceOf(RefreshTokenCommand);
      expect(dispatched).toMatchObject({ userId: 'u1', tokenVersion: 2 });
      expect(result).toBeInstanceOf(TokenPairResponseDto);
      expect(result.accessToken).toBe('a2');
    });

    it('is exempt from the IP throttle; other routes are not', () => {
      // Key set by @SkipThrottle(): THROTTLER_SKIP + throttler name.
      const skipKey = 'THROTTLER:SKIPdefault';
      expect(
        Reflect.getMetadata(skipKey, AuthController.prototype.refresh),
      ).toBe(true);
      for (const route of [
        'login',
        'register',
        'forgotPassword',
        'resetPassword',
      ] as const) {
        expect(
          Reflect.getMetadata(skipKey, AuthController.prototype[route]),
        ).toBeUndefined();
      }
    });
  });

  describe('forgotPassword()', () => {
    it('dispatches RequestPasswordResetCommand and returns an empty object', async () => {
      const result = await controller.forgotPassword({
        email: 'a@example.com',
      });

      const dispatched = mockCommandBus.execute.mock.calls[0][0];
      expect(dispatched).toBeInstanceOf(RequestPasswordResetCommand);
      expect(dispatched).toMatchObject({
        email: 'a@example.com',
        locale: 'en',
      });
      expect(result).toEqual({});
    });
  });

  describe('resetPassword()', () => {
    it('dispatches ResetPasswordCommand', async () => {
      await controller.resetPassword({
        token: 't',
        new_password: 'newPassword1',
        locale: 'vi',
      });

      const dispatched = mockCommandBus.execute.mock.calls[0][0];
      expect(dispatched).toBeInstanceOf(ResetPasswordCommand);
      expect(dispatched).toMatchObject({
        token: 't',
        newPassword: 'newPassword1',
        locale: 'vi',
      });
    });
  });
});
