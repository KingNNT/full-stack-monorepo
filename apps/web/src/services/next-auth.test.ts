// @vitest-environment node
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
	default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (config: unknown) => config }));
vi.mock("@/services/auth.service", () => ({ authService: { login: vi.fn() } }));

const { authConfig } = await import("@/services/next-auth");

const SIGNED_IN_USER: User = {
	id: "1",
	email: "demo@example.com",
	name: "demo_user",
	username: "demo_user",
	accessToken: "access",
	refreshToken: "refresh",
};

type TJwtParams = Parameters<typeof authConfig.callbacks.jwt>[0];
type TSessionParams = Parameters<typeof authConfig.callbacks.session>[0];

describe("authConfig callbacks", () => {
	it("stores the user and API tokens in the JWT on sign-in", () => {
		const token = authConfig.callbacks.jwt({ token: {}, user: SIGNED_IN_USER } as TJwtParams);

		expect(token).toMatchObject({
			id: "1",
			username: "demo_user",
			accessToken: "access",
			refreshToken: "refresh",
		});
	});

	it("keeps the existing JWT on later requests", () => {
		const existing: JWT = { id: "1", accessToken: "access" };

		expect(authConfig.callbacks.jwt({ token: existing } as TJwtParams)).toEqual(existing);
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
});
