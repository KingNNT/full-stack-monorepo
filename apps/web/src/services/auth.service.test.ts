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
const mockGetProfile = vi.fn();

vi.mock("@/apis", () => ({
	authApi: {
		login: (...args: unknown[]) => mockLogin(...args),
		register: (...args: unknown[]) => mockRegister(...args),
	},
	userApi: {
		getProfile: (...args: unknown[]) => mockGetProfile(...args),
	},
}));

const TOKENS = { access_token: "access", refresh_token: "refresh" };
const PROFILE = {
	user_id: "1",
	email: "demo@example.com",
	username: "demo_user",
	is_active: true,
};
const AUTHENTICATED_USER = {
	id: "1",
	email: "demo@example.com",
	username: "demo_user",
	accessToken: "access",
	refreshToken: "refresh",
};

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
		it("returns true for passwords >= 8 characters", () => {
			expect(service.validatePasswordFormat("abcdefgh")).toBe(true);
			expect(service.validatePasswordFormat("a very long password")).toBe(true);
		});

		it("returns false for passwords < 8 characters", () => {
			expect(service.validatePasswordFormat("abcdefg")).toBe(false);
			expect(service.validatePasswordFormat("")).toBe(false);
		});
	});

	describe("validateUsernameFormat", () => {
		it("accepts 3-30 letters, numbers or underscores", () => {
			expect(service.validateUsernameFormat("abc")).toBe(true);
			expect(service.validateUsernameFormat("john_doe_42")).toBe(true);
		});

		it("rejects too short, too long or special characters", () => {
			expect(service.validateUsernameFormat("ab")).toBe(false);
			expect(service.validateUsernameFormat("a".repeat(31))).toBe(false);
			expect(service.validateUsernameFormat("john doe")).toBe(false);
			expect(service.validateUsernameFormat("john-doe")).toBe(false);
		});
	});

	describe("login", () => {
		it("throws MissingCredentialsException when email is empty", async () => {
			await expectToThrow(service.login("", "demo12345"), "MissingCredentialsException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("throws MissingCredentialsException when password is empty", async () => {
			await expectToThrow(service.login("demo@example.com", ""), "MissingCredentialsException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("throws InvalidEmailException for malformed email", async () => {
			await expectToThrow(service.login("not-an-email", "demo12345"), "InvalidEmailException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("throws InvalidPasswordException for short password", async () => {
			await expectToThrow(service.login("demo@example.com", "abc"), "InvalidPasswordException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("logs in with the email as identifier", async () => {
			mockLogin.mockResolvedValue(TOKENS);
			mockGetProfile.mockResolvedValue(PROFILE);

			await service.login("demo@example.com", "password123");

			expect(mockLogin).toHaveBeenCalledWith({
				identifier: "demo@example.com",
				password: "password123",
			});
		});

		it("fetches the profile with the new access token", async () => {
			mockLogin.mockResolvedValue(TOKENS);
			mockGetProfile.mockResolvedValue(PROFILE);

			await service.login("demo@example.com", "password123");

			expect(mockGetProfile).toHaveBeenCalledWith({
				headers: { Authorization: "Bearer access" },
			});
		});

		it("returns the profile together with the API tokens", async () => {
			mockLogin.mockResolvedValue(TOKENS);
			mockGetProfile.mockResolvedValue(PROFILE);

			const user = await service.login("demo@example.com", "password123");

			expect(user).toEqual(AUTHENTICATED_USER);
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
				service.register("", "a@b.com", "pass1234"),
				"MissingCredentialsException",
			);
			await expectToThrow(
				service.register("new_user", "", "pass1234"),
				"MissingCredentialsException",
			);
			await expectToThrow(
				service.register("new_user", "a@b.com", ""),
				"MissingCredentialsException",
			);
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("throws InvalidUsernameException for a malformed username", async () => {
			await expectToThrow(
				service.register("a!", "a@b.com", "pass1234"),
				"InvalidUsernameException",
			);
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("throws InvalidEmailException for malformed email", async () => {
			await expectToThrow(
				service.register("new_user", "not-an-email", "pass1234"),
				"InvalidEmailException",
			);
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("throws InvalidPasswordException for short password", async () => {
			await expectToThrow(
				service.register("new_user", "a@b.com", "abc"),
				"InvalidPasswordException",
			);
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("delegates to authApi.register and returns the new user ID", async () => {
			mockRegister.mockResolvedValue({ user_id: "2" });

			const result = await service.register("new_user", "new@example.com", "securepass");

			expect(mockRegister).toHaveBeenCalledWith({
				username: "new_user",
				email: "new@example.com",
				password: "securepass",
			});
			expect(result).toEqual({ user_id: "2" });
		});

		it("throws EmailExistsException when API returns 409", async () => {
			mockRegister.mockRejectedValue(new HttpStatusError(409, "Conflict"));

			await expectToThrow(
				service.register("new_user", "taken@example.com", "pass1234"),
				"EmailExistsException",
			);
		});

		it("re-throws non-409 API errors", async () => {
			const serverError = new HttpStatusError(500, "Internal Server Error");
			mockRegister.mockRejectedValue(serverError);

			await expect(service.register("new_user", "new@example.com", "pass1234")).rejects.toThrow(
				serverError,
			);
		});
	});
});
