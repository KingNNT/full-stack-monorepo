import { createMockCommandBus } from '../../../../../test/helpers/mocks/command-bus.mock';
import { LoginCommand } from '../../application/commands/login/login.command';
import { RegisterCommand } from '../../application/commands/register/register.command';
import { LoginResponseDto } from '../dtos/login.response.dto';
import { RegisterResponseDto } from '../dtos/register.response.dto';
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
});
