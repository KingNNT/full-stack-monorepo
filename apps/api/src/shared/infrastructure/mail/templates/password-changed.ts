import type { MailTemplateParams } from '../../../application/ports/mail.interface';
import type { Locale } from '../../../domain/locale';
import type { RenderedMail } from './index';
import { htmlLayout } from './layout';

const COPY = {
  en: {
    subject: 'Your password was changed',
    body: {
      change: 'The password for your account was just changed.',
      reset: 'The password for your account was just reset using a reset link.',
    },
    notYou:
      'If this was not you, reset your password now and review your account.',
    action: 'Reset password',
  },
  vi: {
    subject: 'Mật khẩu của bạn đã được thay đổi',
    body: {
      change: 'Mật khẩu tài khoản của bạn vừa được thay đổi (changed).',
      reset: 'Mật khẩu tài khoản của bạn vừa được đặt lại qua link (reset).',
    },
    notYou:
      'Nếu không phải bạn, hãy đặt lại mật khẩu ngay và kiểm tra tài khoản.',
    action: 'Đặt lại mật khẩu',
  },
} satisfies Record<Locale, unknown>;

export function passwordChanged(
  locale: Locale,
  params: MailTemplateParams['password-changed'],
): RenderedMail {
  const c = COPY[locale];
  const body = c.body[params.method];
  return {
    subject: c.subject,
    html: htmlLayout({
      heading: c.subject,
      paragraphs: [body, c.notYou],
      action: { label: c.action, url: params.forgotPasswordUrl },
    }),
    text: [body, '', c.notYou, params.forgotPasswordUrl].join('\n'),
  };
}
