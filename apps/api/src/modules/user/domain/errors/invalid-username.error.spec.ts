import { InvalidUsernameError } from './invalid-username.error';

describe('InvalidUsernameError', () => {
  it('has name "InvalidUsernameError"', () => {
    const error = new InvalidUsernameError('a');

    expect(error.name).toBe('InvalidUsernameError');
  });

  it('includes the username in the message', () => {
    const error = new InvalidUsernameError('a');

    expect(error.message).toBe(
      'Invalid username: "a". Must be 3-30 characters, alphanumeric/underscore only.',
    );
  });

  it('is an instance of Error', () => {
    const error = new InvalidUsernameError('a');

    expect(error).toBeInstanceOf(Error);
  });
});
