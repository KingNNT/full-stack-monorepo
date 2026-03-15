export class InvalidUsernameError extends Error {
  constructor(username: string) {
    super(
      `Invalid username: "${username}". Must be 3-30 characters, alphanumeric/underscore only.`,
    );
    this.name = 'InvalidUsernameError';
  }
}
