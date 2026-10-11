import { createMockTokenService } from '../../../../../../test/helpers/mocks/token-service.mock';
import { RefreshTokenCommand } from './refresh-token.command';
import { RefreshTokenHandler } from './refresh-token.handler';

describe('RefreshTokenHandler', () => {
  it('issues a new pair for the validated user and version', async () => {
    const tokenService = createMockTokenService();
    const handler = new RefreshTokenHandler(tokenService);

    const result = await handler.execute(new RefreshTokenCommand('u1', 4));

    expect(tokenService.generateTokenPair).toHaveBeenCalledWith('u1', 4);
    expect(result).toEqual({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });
  });
});
