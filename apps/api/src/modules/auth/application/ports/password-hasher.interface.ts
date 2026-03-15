export const PASSWORD_HASHER_TOKEN = Symbol('IPasswordHasher');

export interface IPasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, hash: string): Promise<boolean>;
}
