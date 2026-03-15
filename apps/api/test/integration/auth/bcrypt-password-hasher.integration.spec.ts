import { BcryptPasswordHasher } from '../../../src/modules/auth/infrastructure/auth/bcrypt-password-hasher';

describe('BcryptPasswordHasher (integration)', () => {
  let hasher: BcryptPasswordHasher;

  beforeAll(() => {
    hasher = new BcryptPasswordHasher();
  });

  it('hash() produces a bcrypt hash string', async () => {
    const hash = await hasher.hash('password123');

    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
  });

  it('verify() returns true for correct password', async () => {
    const hash = await hasher.hash('correctPassword');

    const result = await hasher.verify('correctPassword', hash);

    expect(result).toBe(true);
  });

  it('verify() returns false for incorrect password', async () => {
    const hash = await hasher.hash('correctPassword');

    const result = await hasher.verify('wrongPassword', hash);

    expect(result).toBe(false);
  });

  it('produces non-deterministic hashes (different salt each time)', async () => {
    const hash1 = await hasher.hash('samePassword');
    const hash2 = await hasher.hash('samePassword');

    expect(hash1).not.toBe(hash2);
    // But both should verify correctly
    expect(await hasher.verify('samePassword', hash1)).toBe(true);
    expect(await hasher.verify('samePassword', hash2)).toBe(true);
  });
});
