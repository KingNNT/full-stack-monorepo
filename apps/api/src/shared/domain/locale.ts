export const SUPPORTED_LOCALES = ['en', 'vi'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function toLocale(value?: string): Locale {
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : 'en';
}
