import { getRequestConfig } from "next-intl/server";
import type { TLocale } from "./config";
import { defaultLocale, locales } from "./config";

const messageImports = {
	en: () => import("@/langs/en.json"),
	vi: () => import("@/langs/vi.json"),
} as const;

async function loadMessages(locale: TLocale) {
	return (await messageImports[locale]()).default;
}

export default getRequestConfig(async ({ requestLocale }) => {
	// Get locale from request or fall back to default
	const requested = await requestLocale;
	const locale =
		requested && locales.includes(requested as TLocale) ? (requested as TLocale) : defaultLocale;

	return {
		locale,
		messages: await loadMessages(locale),
		timeZone: "Asia/Ho_Chi_Minh",
	};
});

export { loadMessages };
