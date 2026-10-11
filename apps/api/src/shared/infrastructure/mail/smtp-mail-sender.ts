import { createTransport, type Transporter } from 'nodemailer';
import type {
  IMailSender,
  MailMessage,
} from '../../application/ports/mail.interface';

export class SmtpMailSender implements IMailSender {
  private readonly transport: Transporter;

  constructor(
    private readonly options: { host: string; port: number; from: string },
  ) {
    // Mailpit and similar dev servers: no TLS, no auth
    this.transport = createTransport({
      host: options.host,
      port: options.port,
      secure: false,
      ignoreTLS: true,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.options.from, ...message });
  }
}
