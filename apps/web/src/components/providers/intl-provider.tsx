"use client";

import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";

interface IIntlProviderProps {
	locale: string;
	messages: AbstractIntlMessages;
	timeZone?: string;
	children: React.ReactNode;
}

export const IntlProvider = ({
	locale,
	messages,
	timeZone = "Asia/Ho_Chi_Minh",
	children,
}: IIntlProviderProps) => {
	return (
		<NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
			{children}
		</NextIntlClientProvider>
	);
};
