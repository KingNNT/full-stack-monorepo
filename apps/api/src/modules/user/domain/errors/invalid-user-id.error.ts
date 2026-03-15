export class InvalidUserIdError extends Error {
  constructor(id: string) {
    super(`UserId cannot be empty`);
    this.name = 'InvalidUserIdError';
  }
}
