import { fn } from "storybook/test";

export const locales = ["en", "vi"] as const;
export const defaultLocale = "en";
export type TLocale = (typeof locales)[number];

export const useRouter = fn().mockName("useRouter").mockReturnValue({
	push: fn(),
	replace: fn(),
	back: fn(),
});

export const usePathname = fn().mockName("usePathname").mockReturnValue("/en/home");

export const Link = "a";

export const redirect = fn().mockName("redirect");

export const getPathname = fn().mockName("getPathname").mockReturnValue("/en/home");
