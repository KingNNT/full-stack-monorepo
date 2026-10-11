import type {
  IMailSender,
  MailMessage,
} from '../../src/shared/application/ports/mail.interface';

export class MailCapture implements IMailSender {
  readonly messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }

  clear(): void {
    this.messages.length = 0;
  }

  lastTo(email: string): MailMessage | undefined {
    return [...this.messages].reverse().find((m) => m.to === email);
  }
}

export function tokenFrom(message: MailMessage): string {
  const match = /reset-password\?token=([^\s"&]+)/.exec(message.text);
  if (!match) throw new Error('No reset link in message');
  return decodeURIComponent(match[1]);
}
