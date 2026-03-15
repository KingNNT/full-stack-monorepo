import { ValueObject } from '../../../../shared/domain/value-object.base';

interface UsernameProps {
  value: string;
}

export class Username extends ValueObject<UsernameProps> {
  private static readonly REGEX = /^[a-zA-Z0-9_]{3,30}$/;

  static create(raw: string): Username {
    if (!Username.REGEX.test(raw)) {
      throw new Error(
        'Invalid username. Must be 3-30 chars, alphanumeric/underscore.',
      );
    }
    return new Username({ value: raw });
  }

  get value(): string {
    return this.props.value;
  }
}
