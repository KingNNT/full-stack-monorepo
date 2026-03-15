import { Username } from './username.vo';

describe('Username', () => {
  it('creates a valid username (alphanumeric)', () => {
    const username = Username.create('testuser');

    expect(username.value).toBe('testuser');
  });

  it('allows underscores', () => {
    const username = Username.create('test_user');

    expect(username.value).toBe('test_user');
  });

  it('allows minimum 3 characters', () => {
    const username = Username.create('abc');

    expect(username.value).toBe('abc');
  });

  it('allows maximum 30 characters', () => {
    const username = Username.create('a'.repeat(30));

    expect(username.value).toBe('a'.repeat(30));
  });

  it('rejects less than 3 characters', () => {
    expect(() => Username.create('ab')).toThrow('Invalid username');
  });

  it('rejects more than 30 characters', () => {
    expect(() => Username.create('a'.repeat(31))).toThrow('Invalid username');
  });

  it('rejects special characters', () => {
    expect(() => Username.create('user@name')).toThrow('Invalid username');
    expect(() => Username.create('user name')).toThrow('Invalid username');
    expect(() => Username.create('user-name')).toThrow('Invalid username');
    expect(() => Username.create('user.name')).toThrow('Invalid username');
  });

  it('rejects empty string', () => {
    expect(() => Username.create('')).toThrow('Invalid username');
  });

  it('allows digits', () => {
    const username = Username.create('user123');

    expect(username.value).toBe('user123');
  });

  it('allows mixed case', () => {
    const username = Username.create('TestUser');

    expect(username.value).toBe('TestUser');
  });

  it('equals() returns true for same value', () => {
    const a = Username.create('testuser');
    const b = Username.create('testuser');

    expect(a.equals(b)).toBe(true);
  });

  it('equals() returns false for different values', () => {
    const a = Username.create('user1');
    const b = Username.create('user2');

    expect(a.equals(b)).toBe(false);
  });
});
