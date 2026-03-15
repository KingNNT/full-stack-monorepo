export const LOCALES = ["en", "vi"] as const;
export const DEFAULT_LOCALE = "en";

export const ROUTES = {
	home: "/home",
	login: "/login",
	register: "/register",
	dashboard: "/dashboard",
	settings: "/settings",
	profile: "/profile",
} as const;

export const PUBLIC_ROUTES = [ROUTES.home, ROUTES.login, ROUTES.register] as const;
export const PRIVATE_ROUTES = [ROUTES.dashboard, ROUTES.settings, ROUTES.profile] as const;

export function withLocale(route: string, locale = DEFAULT_LOCALE): string {
	return `/${locale}${route}`;
}
