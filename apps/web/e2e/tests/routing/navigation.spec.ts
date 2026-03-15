import { expect, test } from "@playwright/test";
import { ROUTES, withLocale } from "../../fixtures/routes";

test.describe("Navigation", () => {
	test("navigates to home page", async ({ page }) => {
		await page.goto(withLocale(ROUTES.home));

		await expect(page).toHaveURL(/\/en\/home/);
	});

	test("navigates to login page", async ({ page }) => {
		await page.goto(withLocale(ROUTES.login));

		await expect(page).toHaveURL(/\/en\/login/);
	});

	test("navigates to register page", async ({ page }) => {
		await page.goto(withLocale(ROUTES.register));

		await expect(page).toHaveURL(/\/en\/register/);
	});
});
