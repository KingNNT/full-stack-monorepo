// @vitest-environment node
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { describe, expect, it, vi } from "vitest";
import { HttpStatusError } from "@/apis/errors";

const mockRefresh = vi.hoisted(() => vi.fn());
const encode = (payload: object) =>
	`h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

vi.mock("next-auth", () => ({
	default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (config: unknown) => config }));
vi.mock("@/services/auth.service", () => ({
	authService: { login: vi.fn(), refresh: mockRefresh },
}));

const { authConfig } = await import("@/services/next-auth");

const SIGNED_IN_USER: User = {
	id: "1",
	email: "demo@example.com",
	name: "demo_user",
	username: "demo_user",
	accessToken: encode({ exp: 4_102_444_800 }),
	refreshToken: "refresh",
};

type TJwtParams = Parameters<typeof authConfig.callbacks.jwt>[0];
type TSessionParams = Parameters<typeof authConfig.callbacks.session>[0];

describe("authConfig callbacks", () => {
	it("stores the user and API tokens in the JWT on sign-in", async () => {
		const token = await authConfig.callbacks.jwt({ token: {}, user: SIGNED_IN_USER } as TJwtParams);

		expect(token).toMatchObject({
			id: "1",
			username: "demo_user",
			accessToken: SIGNED_IN_USER.accessToken,
			refreshToken: "refresh",
		});
	});

	it("keeps the existing JWT on later requests", async () => {
		const existing: JWT = {
			id: "1",
			accessToken: "access",
			accessTokenExpires: Date.now() + 3_600_000,
		};

		expect(await authConfig.callbacks.jwt({ token: existing } as TJwtParams)).toEqual(existing);
	});

	it("exposes the access token and user identity on the session", () => {
		const session = authConfig.callbacks.session({
			session: { user: { email: "demo@example.com" }, expires: "" } as Session,
			token: { id: "1", username: "demo_user", accessToken: "access", refreshToken: "refresh" },
		} as unknown as TSessionParams) as Session;

		expect(session.accessToken).toBe("access");
		expect(session.user).toMatchObject({ id: "1", username: "demo_user" });
	});

	it("does not expose the refresh token on the session", () => {
		const session = authConfig.callbacks.session({
			session: { user: {}, expires: "" } as Session,
			token: { refreshToken: "refresh" },
		} as unknown as TSessionParams);

		expect(JSON.stringify(session)).not.toContain("refresh");
	});

	it("refreshes the API tokens when the access token is about to expire", async () => {
		const fresh = encode({ exp: 4_102_444_800 });
		mockRefresh.mockResolvedValue({ access_token: fresh, refresh_token: "refresh-2" });

		const token = await authConfig.callbacks.jwt({
			token: {
				accessToken: "old",
				refreshToken: "refresh-1",
				accessTokenExpires: Date.now() + 10_000,
			},
		} as unknown as TJwtParams);

		expect(mockRefresh).toHaveBeenCalledWith("refresh-1");
		expect(token).toMatchObject({ accessToken: fresh, refreshToken: "refresh-2" });
		expect(token.error).toBeUndefined();
	});

	it("marks the session as failed and drops the tokens when refresh is rejected", async () => {
		mockRefresh.mockRejectedValue(new HttpStatusError(401, "Unauthorized"));

		const token = await authConfig.callbacks.jwt({
			token: { accessToken: "old", refreshToken: "refresh-1", accessTokenExpires: Date.now() - 1 },
		} as unknown as TJwtParams);

		expect(token).toMatchObject({ error: "RefreshFailed" });
		expect(token.accessToken).toBeUndefined();
		expect(token.refreshToken).toBeUndefined();
	});

	it.each([
		["a 5xx response", new HttpStatusError(503, "Service Unavailable")],
		["a network error", new Error("fetch failed")],
	])("keeps the tokens when refresh fails with %s", async (_label, failure) => {
		mockRefresh.mockRejectedValue(failure);

		const token = await authConfig.callbacks.jwt({
			token: { accessToken: "old", refreshToken: "refresh-1", accessTokenExpires: Date.now() - 1 },
		} as unknown as TJwtParams);

		expect(token).toMatchObject({ accessToken: "old", refreshToken: "refresh-1" });
		expect(token.error).toBeUndefined();
	});

	it("does not retry refresh once it has failed", async () => {
		mockRefresh.mockClear();

		await authConfig.callbacks.jwt({ token: { error: "RefreshFailed" } } as TJwtParams);

		expect(mockRefresh).not.toHaveBeenCalled();
	});

	it("replaces the API tokens on a server-side session update", async () => {
		const fresh = encode({ sub: "1", exp: 4_102_444_800 });

		const token = await authConfig.callbacks.jwt({
			token: { id: "1", accessToken: "old", refreshToken: "old-r" },
			trigger: "update",
			session: { apiTokens: { access_token: fresh, refresh_token: "new-r" } },
		} as unknown as TJwtParams);

		expect(token).toMatchObject({ accessToken: fresh, refreshToken: "new-r" });
		expect(token.accessTokenExpires).toBe(4_102_444_800_000);
	});

	it.each([
		["another user", encode({ sub: "2", exp: 4_102_444_800 })],
		["no subject", encode({ exp: 4_102_444_800 })],
	])("ignores a session update whose access token belongs to %s", async (_label, foreign) => {
		const existing: JWT = { id: "1", accessToken: "old", refreshToken: "old-r" };

		const token = await authConfig.callbacks.jwt({
			token: { ...existing },
			trigger: "update",
			session: { apiTokens: { access_token: foreign, refresh_token: "new-r" } },
		} as unknown as TJwtParams);

		expect(token).toEqual(existing);
	});

	it("exposes the refresh failure on the session", () => {
		const session = authConfig.callbacks.session({
			session: { user: {}, expires: "" } as Session,
			token: { error: "RefreshFailed" },
		} as unknown as TSessionParams) as Session;

		expect(session.error).toBe("RefreshFailed");
	});
});
