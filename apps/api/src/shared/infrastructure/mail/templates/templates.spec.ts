import { renderTemplate } from './index';

describe('mail templates', () => {
  it('renders the reset email in Vietnamese with the link and expiry', () => {
    const mail = renderTemplate('password-reset', 'vi', {
      resetUrl: 'https://app.example.com/vi/reset-password?token=abc',
      ttlMinutes: 30,
    });

    expect(mail.subject).toBe('Đặt lại mật khẩu');
    expect(mail.html).toContain(
      'href="https://app.example.com/vi/reset-password?token=abc"',
    );
    expect(mail.text).toContain('30');
  });

  it('falls back to English for an unknown locale', () => {
    const mail = renderTemplate('password-reset', 'fr', {
      resetUrl: 'https://x.test/r',
      ttlMinutes: 30,
    });

    expect(mail.subject).toBe('Reset your password');
  });

  it('escapes interpolated values in HTML', () => {
    const mail = renderTemplate('password-reset', 'en', {
      resetUrl: 'https://x.test/r?a=1&b="><script>',
      ttlMinutes: 30,
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&amp;b=&quot;&gt;&lt;script&gt;');
  });

  it('words the changed email by method', () => {
    const changed = renderTemplate('password-changed', 'en', {
      method: 'change',
      forgotPasswordUrl: 'https://x.test/en/forgot-password',
    });
    const reset = renderTemplate('password-changed', 'en', {
      method: 'reset',
      forgotPasswordUrl: 'https://x.test/en/forgot-password',
    });

    expect(changed.text).toContain('just changed');
    expect(changed.text).not.toContain('using a reset link');
    expect(reset.text).toContain('using a reset link');
    expect(changed.html).toContain('https://x.test/en/forgot-password');
  });

  it('renders the changed email in Vietnamese without English fragments', () => {
    for (const method of ['change', 'reset'] as const) {
      const mail = renderTemplate('password-changed', 'vi', {
        method,
        forgotPasswordUrl: 'https://x.test/vi/forgot-password',
      });

      expect(mail.subject).toBe('Mật khẩu của bạn đã được thay đổi');
      expect(mail.text).not.toContain('(changed)');
      expect(mail.text).not.toContain('(reset)');
    }
  });
});
