import type { Page } from "@playwright/test";
import { TEST_USER } from "../fixtures/users";
import { LoginPage } from "../pages/LoginPage";

export async function loginAsTestUser(page: Page, locale = "en"): Promise<void> {
	const loginPage = new LoginPage(page);
	await loginPage.goto(locale);
	await loginPage.login(TEST_USER.email, TEST_USER.password);
	await page.waitForURL("**/dashboard");
}
