export const RESET_TOKEN_GENERATOR_TOKEN = Symbol('IResetTokenGenerator');

export interface IResetTokenGenerator {
  /** A new random token and the hash that is stored. */
  generate(): { raw: string; hash: string };
  hash(raw: string): string;
}
