import { CryptoResetTokenGenerator } from './crypto-reset-token-generator';

describe('CryptoResetTokenGenerator', () => {
  const generator = new CryptoResetTokenGenerator();

  it('generates a url-safe 32-byte token and its sha256 hex hash', () => {
    const { raw, hash } = generator.generate();

    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(generator.hash(raw)).toBe(hash);
  });

  it('never repeats', () => {
    expect(generator.generate().raw).not.toBe(generator.generate().raw);
  });
});
