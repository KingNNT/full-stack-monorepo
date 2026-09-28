import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpStatusError } from "@/apis/errors";
import { AuthService } from "@/services/auth.service";

async function expectToThrow(promise: Promise<unknown>, expectedName: string) {
	try {
		await promise;
		expect.fail(`Expected ${expectedName} to be thrown`);
	} catch (error: unknown) {
		const err = error as Error;
		expect(err.name).toBe(expectedName);
	}
}

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

describe("AuthService integration", () => {
	let service: AuthService;

	beforeEach(() => {
		service = new AuthService();
		vi.clearAllMocks();
	});

	describe("login flow", () => {
		it("validates input, logs in, loads the profile and returns user with tokens", async () => {
			mockLogin.mockResolvedValue(TOKENS);
			mockGetProfile.mockResolvedValue(PROFILE);

			const user = await service.login("demo@example.com", "password123");

			expect(mockLogin).toHaveBeenCalledWith({
				identifier: "demo@example.com",
				password: "password123",
			});
			expect(mockGetProfile).toHaveBeenCalledWith({
				headers: { Authorization: "Bearer access" },
			});
			expect(user).toEqual(AUTHENTICATED_USER);
		});

		it("rejects before API call when credentials are missing", async () => {
			await expectToThrow(service.login("", "pass"), "MissingCredentialsException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("rejects before API call when email is invalid", async () => {
			await expectToThrow(service.login("not-an-email", "pass1234"), "InvalidEmailException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("rejects before API call when password is too short", async () => {
			await expectToThrow(service.login("demo@example.com", "abc"), "InvalidPasswordException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("maps 401 API error to InvalidCredentialsException", async () => {
			mockLogin.mockRejectedValue(new HttpStatusError(401, "Unauthorized"));

			await expectToThrow(
				service.login("demo@example.com", "wrongpass123"),
				"InvalidCredentialsException",
			);
		});

		it("propagates non-401 API errors", async () => {
			const serverError = new HttpStatusError(500, "Internal Server Error");
			mockLogin.mockRejectedValue(serverError);

			await expect(service.login("demo@example.com", "pass123456")).rejects.toThrow(serverError);
		});
	});

	describe("register flow", () => {
		it("validates input, calls API, and returns the new user ID", async () => {
			mockRegister.mockResolvedValue({ user_id: "2" });

			const result = await service.register("new_user", "new@example.com", "securepass");

			expect(mockRegister).toHaveBeenCalledWith({
				username: "new_user",
				email: "new@example.com",
				password: "securepass",
			});
			expect(result).toEqual({ user_id: "2" });
		});

		it("rejects before API call when fields are missing", async () => {
			await expectToThrow(
				service.register("", "a@b.com", "pass1234"),
				"MissingCredentialsException",
			);
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("rejects before API call when username is malformed", async () => {
			await expectToThrow(
				service.register("a!", "a@b.com", "pass1234"),
				"InvalidUsernameException",
			);
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("maps 409 API error to EmailExistsException", async () => {
			mockRegister.mockRejectedValue(new HttpStatusError(409, "Conflict"));

			await expectToThrow(
				service.register("new_user", "taken@example.com", "pass1234"),
				"EmailExistsException",
			);
		});

		it("propagates non-409 API errors", async () => {
			const serverError = new HttpStatusError(500, "Internal Server Error");
			mockRegister.mockRejectedValue(serverError);

			await expect(service.register("new_user", "new@example.com", "pass1234")).rejects.toThrow(
				serverError,
			);
		});
	});
});
