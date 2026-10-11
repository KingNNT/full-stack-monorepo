export const TOKEN_SERVICE_TOKEN = Symbol('ITokenService');

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  /** auth_credentials.token_version at issue time; a mismatch means revoked. */
  tv: number;
  iat?: number;
  exp?: number;
}

export interface ITokenService {
  generateTokenPair(userId: string, tokenVersion: number): Promise<TokenPair>;
  verifyAccessToken(token: string): Promise<JwtPayload>;
  verifyRefreshToken(token: string): Promise<JwtPayload>;
}
