import { vi } from "vitest";

interface MockNextAuthOptions {
	signInResult?: { error?: string | null; url?: string | null; ok?: boolean; status?: number };
	sessionStatus?: "authenticated" | "unauthenticated" | "loading";
	sessionUser?: { name?: string; email?: string; image?: string } | null;
}

/**
 * Returns a mock factory for next-auth/react.
 *
 * Usage in test files:
 *   const { signInMock } = createNextAuthMocks();
 *   vi.mock("next-auth/react", () => createNextAuthMocks().factory);
 */
export function createNextAuthMocks(overrides: MockNextAuthOptions = {}) {
	const signInMock = vi
		.fn()
		.mockResolvedValue(overrides.signInResult ?? { error: null, url: null, ok: true, status: 200 });
	const signOutMock = vi.fn();

	const factory = {
		signIn: signInMock,
		signOut: signOutMock,
		useSession: () => ({
			data: overrides.sessionUser ? { user: overrides.sessionUser, expires: "" } : null,
			status: overrides.sessionStatus ?? "unauthenticated",
		}),
		SessionProvider: ({ children }: { children: React.ReactNode }) => children,
	};

	return { signInMock, signOutMock, factory };
}
