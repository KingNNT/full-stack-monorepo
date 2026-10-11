export const PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN = Symbol(
  'IPasswordResetTokenRepository',
);

export interface ResetTokenStats {
  issuedSince: number;
  latestCreatedAt: Date | null;
}

export interface RedeemedReset {
  userId: string;
  email: string;
}

export interface IPasswordResetTokenRepository {
  /** Tokens issued for the user since `since`, and the newest creation time. */
  statsForUser(userId: string, since: Date): Promise<ResetTokenStats>;
  /** Supersedes the user's unused tokens and stores the new one, atomically. */
  issue(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Marks all of the user's unused tokens as used (e.g. after a change). */
  supersedeAllForUser(userId: string): Promise<void>;
  /**
   * Atomically claims a valid token, stores the new password hash, bumps
   * token_version and supersedes the user's other tokens.
   * Returns null when the token is unknown, expired or already used, or the
   * account is inactive.
   */
  redeem(
    tokenHash: string,
    newPasswordHash: string,
  ): Promise<RedeemedReset | null>;
}
