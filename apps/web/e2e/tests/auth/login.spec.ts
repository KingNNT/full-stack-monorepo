import { expect, test } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";

test.describe("Login flow", () => {
	test("redirects to dashboard after successful login", async ({ page }) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.login("demo@example.com", "demo123");

		await page.waitForURL("**/dashboard");
		await expect(page).toHaveURL(/\/en\/dashboard/);
	});

	test("shows login page with correct title", async ({ page }) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();

		await expect(page).toHaveTitle(/Login/);
		await expect(loginPage.emailInput).toBeVisible();
		await expect(loginPage.passwordInput).toBeVisible();
		await expect(loginPage.submitButton).toBeVisible();
	});

	test("redirects unauthenticated user from protected route to login", async ({ page }) => {
		await page.goto("/en/dashboard");

		await expect(page).toHaveURL(/\/en\/login/);
		await expect(page).toHaveURL(/callback-url/);
	});
});
