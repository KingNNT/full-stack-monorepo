import { randomUUID } from 'node:crypto';
import { ValueObject } from '../../../../shared/domain/value-object.base';

interface UserIdProps {
  value: string;
}

export class UserId extends ValueObject<UserIdProps> {
  static create(): UserId {
    return new UserId({ value: randomUUID() });
  }

  static fromString(id: string): UserId {
    if (!id || id.trim().length === 0) {
      throw new Error('UserId cannot be empty');
    }
    return new UserId({ value: id });
  }

  get value(): string {
    return this.props.value;
  }
}
