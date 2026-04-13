export const AUTH_CREDENTIALS_REPOSITORY_TOKEN = Symbol(
  'IAuthCredentialsRepository',
);

export interface AuthCredentialRecord {
  userId: string;
  email: string;
  username: string;
  passwordHash: string;
  isActive: boolean;
}

export interface IAuthCredentialsRepository {
  findByEmailOrUsername(
    identifier: string,
  ): Promise<AuthCredentialRecord | null>;
  findByUserId(userId: string): Promise<AuthCredentialRecord | null>;
  create(
    userId: string,
    email: string,
    username: string,
    passwordHash: string,
  ): Promise<void>;
  updateLastLogin(userId: string, at: Date): Promise<void>;
  updateUsername(userId: string, username: string): Promise<void>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}
