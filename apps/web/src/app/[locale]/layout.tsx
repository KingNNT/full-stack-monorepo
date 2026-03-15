import type { Metadata } from "next";
import { IntlProvider } from "@/components/providers/intl-provider";
import type { TLocale } from "@/i18n/config";
import { loadMessages } from "@/i18n/request";
import type { ILocaleLayoutProps } from "@/types/page";

export async function generateMetadata({ params }: ILocaleLayoutProps): Promise<Metadata> {
	const { locale } = await params;

	// Basic metadata that will be enhanced per page
	return {
		alternates: {
			canonical: `/${locale}`,
			languages: {
				en: "/en",
				vi: "/vi",
			},
		},
	};
}

const LocaleLayout = async ({ children, params }: ILocaleLayoutProps) => {
	const { locale } = await params;
	const messages = await loadMessages(locale as TLocale);

	return (
		<IntlProvider locale={locale} messages={messages}>
			<div data-locale={locale}>{children}</div>
		</IntlProvider>
	);
};

export default LocaleLayout;
