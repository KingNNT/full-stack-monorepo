// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	forgotPassword: vi.fn(),
	resetPassword: vi.fn(),
	changePassword: vi.fn(),
	auth: vi.fn(),
	unstableUpdate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/utils/logger", () => ({ default: { error: vi.fn() } }));
vi.mock("@/services/auth.service", () => ({ authService: mocks }));
vi.mock("@/services/next-auth", () => ({
	auth: mocks.auth,
	unstable_update: mocks.unstableUpdate,
}));

const forgot = await import("./auth/forgot-password/route");
const reset = await import("./auth/reset-password/route");
const change = await import("./users/change-password/route");

const post = (url: string, body: unknown) =>
	new Request(`http://localhost${url}`, {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
	});

describe("password route handlers", () => {
	beforeEach(() => vi.clearAllMocks());

	it("forgot-password forwards email and locale and returns an empty object", async () => {
		const res = await forgot.POST(
			post("/api/v1/auth/forgot-password", { email: "a@b.co", locale: "vi" }) as never,
		);

		expect(mocks.forgotPassword).toHaveBeenCalledWith("a@b.co", "vi");
		expect(res.status).toBe(200);
		expect((await res.json()).data).toEqual({});
	});

	it("reset-password forwards token, password and locale", async () => {
		await reset.POST(
			post("/api/v1/auth/reset-password", {
				token: "t",
				password: "newPass12",
				locale: "en",
			}) as never,
		);

		expect(mocks.resetPassword).toHaveBeenCalledWith("t", "newPass12", "en");
	});

	it("change-password requires a session", async () => {
		mocks.auth.mockResolvedValue(null);

		const res = await change.POST(post("/api/v1/users/change-password", {}) as never);

		expect(res.status).toBe(401);
		expect(mocks.changePassword).not.toHaveBeenCalled();
	});

	it("change-password stores the new pair in the session and does not return it", async () => {
		mocks.auth.mockResolvedValue({ accessToken: "access" });
		mocks.changePassword.mockResolvedValue({ access_token: "a2", refresh_token: "r2" });

		const res = await change.POST(
			post("/api/v1/users/change-password", {
				old_password: "oldPass12",
				new_password: "newPass12",
				locale: "en",
			}) as never,
		);

		expect(mocks.changePassword).toHaveBeenCalledWith("access", "oldPass12", "newPass12", "en");
		expect(mocks.unstableUpdate).toHaveBeenCalledWith({
			apiTokens: { access_token: "a2", refresh_token: "r2" },
		});
		const body = await res.json();
		expect(JSON.stringify(body)).not.toContain("a2");
	});

	it("unknown locales fall back to en", async () => {
		await forgot.POST(
			post("/api/v1/auth/forgot-password", { email: "a@b.co", locale: "fr" }) as never,
		);

		expect(mocks.forgotPassword).toHaveBeenCalledWith("a@b.co", "en");
	});
});
