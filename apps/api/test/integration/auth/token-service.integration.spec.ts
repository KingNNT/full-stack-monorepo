import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TokenServiceImpl } from '../../../src/modules/auth/infrastructure/auth/token.service.impl';

describe('TokenServiceImpl (integration)', () => {
  let tokenService: TokenServiceImpl;

  const ACCESS_SECRET = 'test-access-secret-key-for-testing';
  const REFRESH_SECRET = 'test-refresh-secret-key-for-testing';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        TokenServiceImpl,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'JWT_ACCESS_SECRET') return ACCESS_SECRET;
              if (key === 'JWT_REFRESH_SECRET') return REFRESH_SECRET;
              throw new Error(`Unknown config key: ${key}`);
            },
            get: (key: string, defaultVal: string) => {
              if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
              if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
              return defaultVal;
            },
          },
        },
      ],
    }).compile();

    tokenService = module.get(TokenServiceImpl);
  });

  it('generateTokenPair() returns access and refresh tokens', async () => {
    const pair = await tokenService.generateTokenPair('user-123');

    expect(pair.accessToken).toBeDefined();
    expect(pair.refreshToken).toBeDefined();
    expect(typeof pair.accessToken).toBe('string');
    expect(typeof pair.refreshToken).toBe('string');
  });

  it('verifyAccessToken() returns payload with sub', async () => {
    const pair = await tokenService.generateTokenPair('user-456');

    const payload = await tokenService.verifyAccessToken(pair.accessToken);

    expect(payload.sub).toBe('user-456');
  });

  it('verifyRefreshToken() returns payload with sub', async () => {
    const pair = await tokenService.generateTokenPair('user-789');

    const payload = await tokenService.verifyRefreshToken(pair.refreshToken);

    expect(payload.sub).toBe('user-789');
  });

  it('access token cannot be verified as refresh token', async () => {
    const pair = await tokenService.generateTokenPair('user-123');

    await expect(
      tokenService.verifyRefreshToken(pair.accessToken),
    ).rejects.toThrow();
  });

  it('refresh token cannot be verified as access token', async () => {
    const pair = await tokenService.generateTokenPair('user-123');

    await expect(
      tokenService.verifyAccessToken(pair.refreshToken),
    ).rejects.toThrow();
  });

  it('rejects an invalid token', async () => {
    await expect(
      tokenService.verifyAccessToken('invalid-token'),
    ).rejects.toThrow();
  });

  it('access and refresh tokens are different', async () => {
    const pair = await tokenService.generateTokenPair('user-123');

    expect(pair.accessToken).not.toBe(pair.refreshToken);
  });
});
