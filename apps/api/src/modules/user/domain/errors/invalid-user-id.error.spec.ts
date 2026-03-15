import { InvalidUserIdError } from './invalid-user-id.error';

describe('InvalidUserIdError', () => {
  it('has name "InvalidUserIdError"', () => {
    const error = new InvalidUserIdError('');

    expect(error.name).toBe('InvalidUserIdError');
  });

  it('has the expected message', () => {
    const error = new InvalidUserIdError('');

    expect(error.message).toBe('UserId cannot be empty');
  });

  it('is an instance of Error', () => {
    const error = new InvalidUserIdError('');

    expect(error).toBeInstanceOf(Error);
  });
});
