import type { IMailSender } from '../../application/ports/mail.interface';
import { MailService } from './mail.service';

describe('MailService', () => {
  it('renders the template and sends it to the recipient', async () => {
    const sender: jest.Mocked<IMailSender> = { send: jest.fn() };
    const service = new MailService(sender);

    await service.sendTemplate('a@example.com', 'password-reset', 'en', {
      resetUrl: 'https://x.test/r',
      ttlMinutes: 30,
    });

    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@example.com',
        subject: 'Reset your password',
      }),
    );
  });
});
