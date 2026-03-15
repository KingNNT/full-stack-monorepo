import { UserId } from './user-id.vo';

describe('UserId', () => {
  it('create() generates a valid UUID', () => {
    const id = UserId.create();

    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('create() generates unique IDs', () => {
    const id1 = UserId.create();
    const id2 = UserId.create();

    expect(id1.value).not.toBe(id2.value);
  });

  it('fromString() accepts a valid string', () => {
    const value = '550e8400-e29b-41d4-a716-446655440000';
    const id = UserId.fromString(value);

    expect(id.value).toBe(value);
  });

  it('fromString() throws on empty string', () => {
    expect(() => UserId.fromString('')).toThrow('UserId cannot be empty');
  });

  it('fromString() throws on whitespace-only string', () => {
    expect(() => UserId.fromString('   ')).toThrow('UserId cannot be empty');
  });

  it('equals() returns true for same value', () => {
    const value = '550e8400-e29b-41d4-a716-446655440000';
    const id1 = UserId.fromString(value);
    const id2 = UserId.fromString(value);

    expect(id1.equals(id2)).toBe(true);
  });

  it('equals() returns false for different values', () => {
    const id1 = UserId.create();
    const id2 = UserId.create();

    expect(id1.equals(id2)).toBe(false);
  });
});
