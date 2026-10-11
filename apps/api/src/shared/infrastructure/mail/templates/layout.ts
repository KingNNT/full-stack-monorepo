import { escapeHtml } from './escape-html';

/** Minimal inline-styled wrapper; every argument is escaped here. */
export function htmlLayout(options: {
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
}): string {
  const paragraphs = options.paragraphs
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`)
    .join('');
  const action = options.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(options.action.url)}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">${escapeHtml(options.action.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:20px">${escapeHtml(options.heading)}</h1>${paragraphs}${action}</body></html>`;
}
