import { InvalidCredentialsError } from './invalid-credentials.error';

describe('InvalidCredentialsError', () => {
  it('has name "InvalidCredentialsError"', () => {
    const error = new InvalidCredentialsError();

    expect(error.name).toBe('InvalidCredentialsError');
  });

  it('has message "Invalid credentials"', () => {
    const error = new InvalidCredentialsError();

    expect(error.message).toBe('Invalid credentials');
  });

  it('is an instance of Error', () => {
    const error = new InvalidCredentialsError();

    expect(error).toBeInstanceOf(Error);
  });
});
