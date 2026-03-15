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

vi.mock("@/apis", () => ({
	authApi: {
		login: (...args: unknown[]) => mockLogin(...args),
		register: (...args: unknown[]) => mockRegister(...args),
	},
}));

describe("AuthService integration", () => {
	let service: AuthService;

	beforeEach(() => {
		service = new AuthService();
		vi.clearAllMocks();
	});

	describe("login flow", () => {
		it("validates input, calls API, and returns user on success", async () => {
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

		it("rejects before API call when credentials are missing", async () => {
			await expectToThrow(service.login("", "pass"), "MissingCredentialsException");
			expect(mockLogin).not.toHaveBeenCalled();
		});

		it("rejects before API call when email is invalid", async () => {
			await expectToThrow(service.login("not-an-email", "pass123"), "InvalidEmailException");
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
		it("validates input, calls API, and returns user on success", async () => {
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

		it("rejects before API call when fields are missing", async () => {
			await expectToThrow(
				service.register("", "a@b.com", "pass123"),
				"MissingCredentialsException",
			);
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("rejects before API call when name is too short", async () => {
			await expectToThrow(service.register("A", "a@b.com", "pass123"), "InvalidNameException");
			expect(mockRegister).not.toHaveBeenCalled();
		});

		it("maps 409 API error to EmailExistsException", async () => {
			mockRegister.mockRejectedValue(new HttpStatusError(409, "Conflict"));

			await expectToThrow(
				service.register("New User", "taken@example.com", "pass123"),
				"EmailExistsException",
			);
		});

		it("propagates non-409 API errors", async () => {
			const serverError = new HttpStatusError(500, "Internal Server Error");
			mockRegister.mockRejectedValue(serverError);

			await expect(service.register("New User", "new@example.com", "pass123")).rejects.toThrow(
				serverError,
			);
		});
	});
});
