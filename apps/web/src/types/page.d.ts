/**
 * Common props for pages under [locale] route
 */
export interface ILocalePageProps {
	params: Promise<{
		locale: string;
	}>;
}

/**
 * Common props for layouts under [locale] route
 */
export interface ILocaleLayoutProps {
	params: Promise<{
		locale: string;
	}>;
	children: React.ReactNode;
}

export type TLocalePageProps = ILocalePageProps;
export type TLocaleLayoutProps = ILocaleLayoutProps;
