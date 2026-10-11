import type { MailTemplateParams } from '../../../application/ports/mail.interface';
import type { Locale } from '../../../domain/locale';
import type { RenderedMail } from './index';
import { htmlLayout } from './layout';

const COPY = {
  en: {
    subject: 'Reset your password',
    intro: 'We received a request to reset the password for your account.',
    expiry: (m: number) => `This link expires in ${m} minutes and works once.`,
    ignore:
      'If you did not ask for this, ignore this email; your password stays the same.',
    action: 'Reset password',
  },
  vi: {
    subject: 'Đặt lại mật khẩu',
    intro:
      'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
    expiry: (m: number) =>
      `Link có hiệu lực trong ${m} phút và chỉ dùng được một lần.`,
    ignore:
      'Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu của bạn không đổi.',
    action: 'Đặt lại mật khẩu',
  },
} satisfies Record<Locale, unknown>;

export function passwordReset(
  locale: Locale,
  params: MailTemplateParams['password-reset'],
): RenderedMail {
  const c = COPY[locale];
  const lines = [c.intro, c.expiry(params.ttlMinutes), c.ignore];
  return {
    subject: c.subject,
    html: htmlLayout({
      heading: c.subject,
      paragraphs: lines,
      action: { label: c.action, url: params.resetUrl },
    }),
    text: [
      c.intro,
      '',
      params.resetUrl,
      '',
      c.expiry(params.ttlMinutes),
      c.ignore,
    ].join('\n'),
  };
}
