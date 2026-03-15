import type { Page } from "@playwright/test";
import { DEFAULT_LOCALE } from "../fixtures/routes";

export async function navigateTo(page: Page, path: string, locale = DEFAULT_LOCALE): Promise<void> {
	await page.goto(`/${locale}${path}`);
}

export async function waitForNavigation(page: Page, urlPattern: RegExp): Promise<void> {
	await page.waitForURL(urlPattern);
}
