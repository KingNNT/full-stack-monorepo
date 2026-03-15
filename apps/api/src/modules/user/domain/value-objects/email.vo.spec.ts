import { Email } from './email.vo';

describe('Email', () => {
  it('creates a valid email', () => {
    const email = Email.create('user@example.com');

    expect(email.value).toBe('user@example.com');
  });

  it('normalizes to lowercase', () => {
    const email = Email.create('User@EXAMPLE.COM');

    expect(email.value).toBe('user@example.com');
  });

  it('trims whitespace', () => {
    const email = Email.create('  user@example.com  ');

    expect(email.value).toBe('user@example.com');
  });

  it('rejects email without @', () => {
    expect(() => Email.create('userexample.com')).toThrow(
      'Invalid email format',
    );
  });

  it('rejects email without domain', () => {
    expect(() => Email.create('user@')).toThrow('Invalid email format');
  });

  it('rejects email without local part', () => {
    expect(() => Email.create('@example.com')).toThrow('Invalid email format');
  });

  it('rejects empty string', () => {
    expect(() => Email.create('')).toThrow('Invalid email format');
  });

  it('rejects email with spaces', () => {
    expect(() => Email.create('user @example.com')).toThrow(
      'Invalid email format',
    );
  });

  it('equals() returns true for same email', () => {
    const a = Email.create('user@example.com');
    const b = Email.create('user@example.com');

    expect(a.equals(b)).toBe(true);
  });

  it('equals() returns true for same email with different casing', () => {
    const a = Email.create('user@example.com');
    const b = Email.create('USER@EXAMPLE.COM');

    expect(a.equals(b)).toBe(true);
  });

  it('equals() returns false for different emails', () => {
    const a = Email.create('user1@example.com');
    const b = Email.create('user2@example.com');

    expect(a.equals(b)).toBe(false);
  });
});
