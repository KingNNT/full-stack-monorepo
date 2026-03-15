export const TOKEN_SERVICE_TOKEN = Symbol('ITokenService');

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

export interface ITokenService {
  generateTokenPair(userId: string): Promise<TokenPair>;
  verifyAccessToken(token: string): Promise<JwtPayload>;
  verifyRefreshToken(token: string): Promise<JwtPayload>;
}
