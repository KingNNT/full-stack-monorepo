import { expect, test } from "@playwright/test";
import { PRIVATE_ROUTES, withLocale } from "../../fixtures/routes";

test.describe("Protected routes", () => {
	for (const route of PRIVATE_ROUTES) {
		test(`redirects unauthenticated user from ${route} to login`, async ({ page }) => {
			await page.goto(withLocale(route));

			await expect(page).toHaveURL(/\/en\/login/);
			await expect(page).toHaveURL(/callback-url/);
		});
	}
});
