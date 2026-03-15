import type { Locator, Page } from "@playwright/test";

export class LoginPage {
	readonly page: Page;
	readonly emailInput: Locator;
	readonly passwordInput: Locator;
	readonly submitButton: Locator;
	readonly errorMessage: Locator;

	constructor(page: Page) {
		this.page = page;
		this.emailInput = page.getByLabel("Email");
		this.passwordInput = page.getByLabel("Password");
		this.submitButton = page.getByRole("button", { name: /sign in/i });
		this.errorMessage = page.locator("[role='alert']");
	}

	async goto(locale = "en") {
		await this.page.goto(`/${locale}/login`);
	}

	async login(email: string, password: string) {
		await this.emailInput.fill(email);
		await this.passwordInput.fill(password);
		await this.submitButton.click();
	}
}
