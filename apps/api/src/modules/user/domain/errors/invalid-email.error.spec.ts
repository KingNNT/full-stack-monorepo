import { InvalidEmailError } from './invalid-email.error';

describe('InvalidEmailError', () => {
  it('has name "InvalidEmailError"', () => {
    const error = new InvalidEmailError('bad-email');

    expect(error.name).toBe('InvalidEmailError');
  });

  it('includes the email in the message', () => {
    const error = new InvalidEmailError('bad-email');

    expect(error.message).toBe('Invalid email format: bad-email');
  });

  it('is an instance of Error', () => {
    const error = new InvalidEmailError('bad-email');

    expect(error).toBeInstanceOf(Error);
  });
});
