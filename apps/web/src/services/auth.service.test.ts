// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpStatusError } from "@/apis/errors";
import { AuthService } from "@/services/auth.service";

/**
 * Helper to assert that a promise rejects with a specific exception name.
 * Uses error.name instead of instanceof because Object.setPrototypeOf
 * in the exception classes can cause instanceof to fail across environments.
 */
async function expectToThrow(promise: Promise<unknown>, expectedName: string) {
	try {
		await promise;
		expect.fail(`Expected ${expectedName} to be thrown`);
	} catch (error: unknown) {
		const err = error as Error;
		expect(err.name).toBe(expectedName);
	}
}

// Mock authApi
const mockLogin = vi.fn();
const mockRegister = vi.fn();

vi.mock("@/apis", () => ({
	authApi: {
		login: (...args: unknown[]) => mockLogin(...args),
		register: (...args: unknown[]) => mockRegister(...args),
	},
}));

describe("AuthService", () => {
	let service: AuthService;

	beforeEach(() => {
		service = new AuthService();
		vi.clearAllMocks();
	});

	describe("validateEmailFormat", () => {
		it("returns true for valid emails", () => {
			expect(service.validateEmailFormat("user@example.com")).toBe(true);
			expect(service.validateEmailFormat("user+tag@domain.co.uk")).toBe(true);
		});

		it("returns false for invalid emails", () => {
			expect(service.validateEmailFormat("not-an-email")).toBe(false);
			expect(service.validateEmailFormat("@nodomain")).toBe(false);
			expect(service.validateEmailFormat("noatsign.com")).toBe(false);
			expect(service.validateEmailFormat("")).toBe(false);
		});
	});

	describe("validatePasswordFormat", () => {
		it("returns true for passwords >= 6 characters", () => {
			expect(service.validatePasswordFormat("abcdef")).toBe(true);
			expect(service.validatePasswordFormat("a very long password")).toBe(true);
		});

		it("returns false for passwords < 6 characters", () => {
			expect(service.validatePasswordFormat("abc")).toBe(false);
			expect(service.validatePasswordFormat("")).toBe(false);
		});
	});

	describe("login", () => {
		it("throws MissingCredentialsException when email is empty", async () => {
			await expectToThrow(service.login("", "demo123"), "MissingCredentialsException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("throws MissingCredentialsException when password is empty", async () => {
			await expectToThrow(service.login("demo@example.com", ""), "MissingCredentialsException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("throws InvalidEmailException for malformed email", async () => {
			await expectToThrow(service.login("not-an-email", "demo123"), "InvalidEmailException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("throws InvalidPasswordException for short password", async () => {
			await expectToThrow(service.login("demo@example.com", "abc"), "InvalidPasswordException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("delegates to authApi.login and returns user on success", async () => {
			const mockUser = { id: "1", name: "Demo User", email: "demo@example.com" };
			mockLogin.mockResolvedValue({
				access_token: "token",
				refresh_token: "refresh",
				user: mockUser,
			});

			const user = await service.login("demo@example.com", "password123");

			expect(mockLogin).toHaveBeenCalledWith({
				email: "demo@example.com",
				password: "password123",
			});
			expect(user).toEqual(mockUser);
		});

		it("throws InvalidCredentialsException when API returns 401", async () => {
			mockLogin.mockRejectedValue(new HttpStatusError(401, "Unauthorized"));

			await expectToThrow(
				service.login("demo@example.com", "wrongpassword"),
				"InvalidCredentialsException",
			);
		});

		it("re-throws non-401 API errors", async () => {
			const serverError = new HttpStatusError(500, "Internal Server Error");
			mockLogin.mockRejectedValue(serverError);

			await expect(service.login("demo@example.com", "password123")).rejects.toThrow(serverError);
		});
	});

	describe("register", () => {
		it("throws MissingCredentialsException when any field is empty", async () => {
			await expectToThrow(
				service.register("", "a@b.com", "pass123"),
				"MissingCredentialsException",
			);
			await expectToThrow(service.register("Name", "", "pass123"), "MissingCredentialsException");
			await expectToThrow(service.register("Name", "a@b.com", ""), "MissingCredentialsException");
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("throws InvalidNameException for single-character name", async () => {
			await expectToThrow(service.register("A", "a@b.com", "pass123"), "InvalidNameException");
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("throws InvalidEmailException for malformed email", async () => {
			await expectToThrow(
				service.register("Valid Name", "not-an-email", "pass123"),
				"InvalidEmailException",
			);
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("throws InvalidPasswordException for short password", async () => {
			await expectToThrow(
				service.register("Valid Name", "a@b.com", "abc"),
				"InvalidPasswordException",
			);
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("delegates to authApi.register and returns user on success", async () => {
			const mockUser = { id: "2", name: "New User", email: "new@example.com" };
			mockRegister.mockResolvedValue({ user: mockUser });

			const user = await service.register("New User", "new@example.com", "securepass");

			expect(mockRegister).toHaveBeenCalledWith({
				name: "New User",
				email: "new@example.com",
				password: "securepass",
			});
			expect(user).toEqual(mockUser);
		});

		it("throws EmailExistsException when API returns 409", async () => {
			mockRegister.mockRejectedValue(new HttpStatusError(409, "Conflict"));

			await expectToThrow(
				service.register("New User", "taken@example.com", "pass123"),
				"EmailExistsException",
			);
		});

		it("re-throws non-409 API errors", async () => {
			const serverError = new HttpStatusError(500, "Internal Server Error");
			mockRegister.mockRejectedValue(serverError);

			await expect(service.register("New User", "new@example.com", "pass123")).rejects.toThrow(
				serverError,
			);
		});
	});
});
