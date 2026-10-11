import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type {
  IMailSender,
  MailMessage,
} from '../../application/ports/mail.interface';

export class SesMailSender implements IMailSender {
  // Credentials and AWS_ENDPOINT_URL come from the SDK default chain (IRSA on EKS)
  private readonly client: SESv2Client;

  constructor(
    private readonly options: {
      region?: string;
      from: string;
      configurationSet?: string;
    },
  ) {
    this.client = new SESv2Client({ region: options.region });
  }

  async send(message: MailMessage): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.options.from,
        Destination: { ToAddresses: [message.to] },
        ConfigurationSetName: this.options.configurationSet,
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: message.html, Charset: 'UTF-8' },
              Text: { Data: message.text, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
  }
}
