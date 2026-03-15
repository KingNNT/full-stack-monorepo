import { ValueObject } from '../../../../shared/domain/value-object.base';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private static readonly REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!Email.REGEX.test(normalized)) {
      throw new Error(`Invalid email format: ${raw}`);
    }
    return new Email({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }
}
