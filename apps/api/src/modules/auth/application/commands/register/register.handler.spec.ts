import { ConflictException } from '@nestjs/common';
import { createMockAuthCredentialsRepository } from '../../../../../../test/helpers/mocks/auth-credentials.mock';
import { createMockCommandBus } from '../../../../../../test/helpers/mocks/command-bus.mock';
import { createMockPinoLogger } from '../../../../../../test/helpers/mocks/logger.mock';
import { createMockPasswordHasher } from '../../../../../../test/helpers/mocks/password-hasher.mock';
import { CreateUserCommand } from '../../../../user/application/commands/create-user/create-user.command';
import type { IAuthCredentialsRepository } from '../../ports/auth-credentials.repository.interface';
import type { IPasswordHasher } from '../../ports/password-hasher.interface';
import { RegisterCommand } from './register.command';
import { RegisterHandler } from './register.handler';

describe('RegisterHandler', () => {
  let handler: RegisterHandler;
  let mockHasher: jest.Mocked<IPasswordHasher>;
  let mockCredentials: jest.Mocked<IAuthCredentialsRepository>;
  let mockCommandBus: jest.Mocked<
    Pick<import('@nestjs/cqrs').CommandBus, 'execute'>
  >;

  beforeEach(() => {
    const mockLogger = createMockPinoLogger();
    mockHasher = createMockPasswordHasher();
    mockCredentials = createMockAuthCredentialsRepository();
    mockCommandBus = createMockCommandBus();
    mockCommandBus.execute.mockResolvedValue({ userId: 'new-user-id' });

    handler = new RegisterHandler(
      mockLogger as any,
      mockHasher,
      mockCredentials,
      mockCommandBus as any,
    );
  });

  it('hashes the password', async () => {
    const command = new RegisterCommand(
      'test@example.com',
      'testuser',
      'securePassword123',
    );

    await handler.execute(command);

    expect(mockHasher.hash).toHaveBeenCalledWith('securePassword123');
  });

  it('dispatches CreateUserCommand via CommandBus', async () => {
    const command = new RegisterCommand(
      'test@example.com',
      'testuser',
      'securePassword123',
    );

    await handler.execute(command);

    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    const dispatched = mockCommandBus.execute.mock
      .calls[0][0] as CreateUserCommand;
    expect(dispatched).toBeInstanceOf(CreateUserCommand);
    expect(dispatched.email).toBe('test@example.com');
    expect(dispatched.username).toBe('testuser');
  });

  it('stores credentials with hashed password', async () => {
    mockHasher.hash.mockResolvedValue('$2b$12$hashed');
    const command = new RegisterCommand(
      'test@example.com',
      'testuser',
      'securePassword123',
    );

    await handler.execute(command);

    expect(mockCredentials.create).toHaveBeenCalledWith(
      'new-user-id',
      'test@example.com',
      'testuser',
      '$2b$12$hashed',
    );
  });

  it('returns userId from the created user', async () => {
    const command = new RegisterCommand(
      'test@example.com',
      'testuser',
      'securePassword123',
    );

    const result = await handler.execute(command);

    expect(result.userId).toBe('new-user-id');
  });

  it('rejects password shorter than 8 characters', async () => {
    const command = new RegisterCommand(
      'test@example.com',
      'testuser',
      'short',
    );

    await expect(handler.execute(command)).rejects.toThrow(
      'Password must be at least 8 characters',
    );
    expect(mockHasher.hash).not.toHaveBeenCalled();
  });

  it('rejects empty password', async () => {
    const command = new RegisterCommand('test@example.com', 'testuser', '');

    await expect(handler.execute(command)).rejects.toThrow(
      'Password must be at least 8 characters',
    );
  });

  it('rejects duplicate email before writing to EventStoreDB', async () => {
    mockCredentials.findByEmailOrUsername.mockResolvedValueOnce({
      userId: 'existing-id',
      email: 'test@example.com',
      username: 'existinguser',
      passwordHash: '$2b$12$hashed',
      isActive: true,
    });

    const command = new RegisterCommand(
      'test@example.com',
      'newuser',
      'securePassword123',
    );

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(mockCommandBus.execute).not.toHaveBeenCalled();
    expect(mockCredentials.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate username before writing to EventStoreDB', async () => {
    mockCredentials.findByEmailOrUsername
      .mockResolvedValueOnce(null) // email check passes
      .mockResolvedValueOnce({
        // username check fails
        userId: 'existing-id',
        email: 'other@example.com',
        username: 'testuser',
        passwordHash: '$2b$12$hashed',
        isActive: true,
      });

    const command = new RegisterCommand(
      'new@example.com',
      'testuser',
      'securePassword123',
    );

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(mockCommandBus.execute).not.toHaveBeenCalled();
    expect(mockCredentials.create).not.toHaveBeenCalled();
  });
});
