import { BadRequestException } from '@nestjs/common';

export class WeakPasswordError extends BadRequestException {
  constructor(message: string = 'Password does not meet requirements') {
    super({ message, errorCode: 'WEAK_PASSWORD' });
    this.name = 'WeakPasswordError';
  }
}
