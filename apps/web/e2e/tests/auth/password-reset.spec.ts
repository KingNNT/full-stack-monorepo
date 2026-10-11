import { expect, test } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import { waitForResetToken } from "../../utils/mailpit";

const API_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

test.describe("Password management", () => {
	test.describe.configure({ mode: "serial" });

	let user: { email: string; username: string; password: string };

	test.beforeEach(async ({ request }) => {
		const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
		user = { email: `pw-${id}@example.com`, username: `pw_${id}`, password: "originalPass1" };
		const res = await request.post(`${API_URL}/api/v1/auth/register`, { data: user });
		expect(res.ok()).toBeTruthy();
	});

	test("forgot password → email link → reset → sign in with the new password", async ({
		page,
		request,
	}) => {
		await page.goto("/en/login");
		await page.getByRole("link", { name: "Forgot password?" }).click();
		await page.waitForLoadState("networkidle");
		await page.getByLabel("Email").fill(user.email);
		await page.getByRole("button", { name: "Send reset link" }).click();
		await expect(page.getByRole("status")).toContainText("reset link has been sent");

		const token = await waitForResetToken(request, user.email);
		await page.goto(`/en/reset-password?token=${encodeURIComponent(token)}`);
		await page.getByLabel("New password", { exact: true }).fill("brandNewPass1");
		await page.getByLabel("Confirm new password").fill("brandNewPass1");
		await page.getByRole("button", { name: "Reset password" }).click();

		await page.waitForURL("**/login?reason=password_reset");
		await expect(page.getByRole("status")).toContainText("password has been reset");

		const login = new LoginPage(page);
		await login.login(user.email, "brandNewPass1");
		await page.waitForURL("**/dashboard");
	});

	test("a used reset link is rejected", async ({ page, request }) => {
		const forgot = await request.post(`${API_URL}/api/v1/auth/forgot-password`, {
			data: { email: user.email, locale: "en" },
		});
		expect(forgot.ok()).toBeTruthy();
		const token = await waitForResetToken(request, user.email);
		const reset = await request.post(`${API_URL}/api/v1/auth/reset-password`, {
			data: { token, new_password: "firstReset123" },
		});
		expect(reset.ok()).toBeTruthy();

		await page.goto(`/en/reset-password?token=${encodeURIComponent(token)}`);
		await page.getByLabel("New password", { exact: true }).fill("secondReset12");
		await page.getByLabel("Confirm new password").fill("secondReset12");
		await page.getByRole("button", { name: "Reset password" }).click();

		await expect(
			page.getByRole("alert").filter({ hasText: "invalid or has expired" }),
		).toBeVisible();
	});

	test("change password keeps the session and the new password works", async ({ page }) => {
		const login = new LoginPage(page);
		await login.goto();
		await login.login(user.email, user.password);
		await page.waitForURL("**/dashboard");

		await page.goto("/en/settings/security");
		await page.getByLabel("Current password").fill(user.password);
		await page.getByLabel("New password", { exact: true }).fill("changedPass12");
		await page.getByLabel("Confirm new password").fill("changedPass12");
		await page.getByRole("button", { name: "Change password" }).click();
		await expect(page.getByRole("status")).toContainText("Password changed");

		await page.goto("/en/dashboard");
		await expect(page).toHaveURL(/\/en\/dashboard/);

		await page.context().clearCookies();
		await login.goto();
		await login.login(user.email, "changedPass12");
		await page.waitForURL("**/dashboard");
	});
});
