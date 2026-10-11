import type { StartedTestContainer } from 'testcontainers';
import { SmtpMailSender } from '../../../src/shared/infrastructure/mail/smtp-mail-sender';
import { listMessages, startMailpit } from '../../helpers/mailpit-setup';

describe('SmtpMailSender (integration)', () => {
  let mailpit: StartedTestContainer;

  beforeAll(async () => {
    mailpit = await startMailpit();
  }, 60_000);

  afterAll(async () => {
    await mailpit?.stop();
  });

  it('delivers a message to Mailpit', async () => {
    const sender = new SmtpMailSender({
      host: mailpit.getHost(),
      port: mailpit.getMappedPort(1025),
      from: 'App <no-reply@localhost>',
    });

    await sender.send({
      to: 'someone@example.com',
      subject: 'Hello from the test',
      html: '<p>hi</p>',
      text: 'hi',
    });

    const messages = await listMessages(mailpit);
    expect(messages[0].Subject).toBe('Hello from the test');
    expect(messages[0].To[0].Address).toBe('someone@example.com');
  });
});
