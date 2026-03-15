import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SUPER_ADMIN_ROLE } from '../../domain/constants/rbac.constants';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;
  let mockRepo: any;

  const mockContext = (userId: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: userId },
        }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    mockRepo = {
      modelHasRole: jest.fn(),
      resolveModelPermissions: jest.fn(),
    };
    guard = new PermissionGuard(reflector, mockRepo);
  });

  it('should allow when no permissions metadata', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const result = await guard.canActivate(mockContext('user-1'));
    expect(result).toBe(true);
  });

  it('should allow super-admin without checking permissions', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['users.create']);
    mockRepo.modelHasRole.mockResolvedValue(true);

    const result = await guard.canActivate(mockContext('user-1'));

    expect(result).toBe(true);
    expect(mockRepo.modelHasRole).toHaveBeenCalledWith(
      'user',
      'user-1',
      SUPER_ADMIN_ROLE,
    );
    expect(mockRepo.resolveModelPermissions).not.toHaveBeenCalled();
  });

  it('should allow when user has all required permissions', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['users.create']);
    mockRepo.modelHasRole.mockResolvedValue(false);
    mockRepo.resolveModelPermissions.mockResolvedValue([
      { id: '1', name: 'users.create' },
      { id: '2', name: 'users.read' },
    ]);

    const result = await guard.canActivate(mockContext('user-1'));
    expect(result).toBe(true);
  });

  it('should deny when user lacks required permission', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['users.delete']);
    mockRepo.modelHasRole.mockResolvedValue(false);
    mockRepo.resolveModelPermissions.mockResolvedValue([
      { id: '1', name: 'users.create' },
    ]);

    await expect(guard.canActivate(mockContext('user-1'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should require ALL permissions when multiple specified', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['users.create', 'users.delete']);
    mockRepo.modelHasRole.mockResolvedValue(false);
    mockRepo.resolveModelPermissions.mockResolvedValue([
      { id: '1', name: 'users.create' },
    ]);

    await expect(guard.canActivate(mockContext('user-1'))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
