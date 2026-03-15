import type { LocaleSupport } from "@/enums";

export function getLocaleDirection(locale: LocaleSupport): "ltr" | "rtl" {
	// Currently all supported locales are left-to-right
	// Add logic here if you support RTL languages like Arabic or Hebrew
	// The locale parameter is reserved for future RTL language support
	void locale;
	return "ltr";
}
