import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { HttpStatusError } from "@/apis/errors";
import { AuthException } from "@/exceptions";
import type { ILoginData } from "@/types/auth";
import { getJwtExpiry, getJwtSubject } from "@/utils/jwt";
import { authService } from "./auth.service";

// Refresh a minute early so a request never leaves with an access token that expires in flight
const REFRESH_MARGIN_MS = 60_000;

const withApiTokens = (token: JWT, tokens: ILoginData): JWT => ({
	...token,
	accessToken: tokens.access_token,
	refreshToken: tokens.refresh_token,
	accessTokenExpires: getJwtExpiry(tokens.access_token) ?? undefined,
	error: undefined,
});

export const authConfig = {
	providers: [
		Credentials({
			name: "Credentials",
			credentials: {
				email: { label: "Email", type: "email", placeholder: "user@example.com" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				try {
					if (!credentials?.email || !credentials?.password) {
						throw new Error("Missing credentials");
					}

					const email = credentials.email as string;
					const password = credentials.password as string;

					// Service returns the user plus API tokens, or throws
					const user = await authService.login(email, password);

					return { ...user, name: user.username };
				} catch (error) {
					// Convert AuthException to NextAuth error with code
					if (error instanceof AuthException) {
						throw new Error(error.code);
					}

					// Re-throw other errors
					throw error;
				}
			},
		}),
	],
	pages: {
		signIn: "/login",
	},
	callbacks: {
		authorized() {
			// Let middleware handle all authentication logic
			return true;
		},
		async jwt({ token, user, trigger, session }) {
			// `user` is only set on sign-in: keep the API tokens in the encrypted JWT cookie
			if (user) {
				token.id = user.id;
				token.username = user.username;
				token.accessToken = user.accessToken;
				token.refreshToken = user.refreshToken;
				token.accessTokenExpires = user.accessToken
					? (getJwtExpiry(user.accessToken) ?? undefined)
					: undefined;
				return token;
			}

			// Server-side unstable_update() after a password change hands over the new pair
			const apiTokens = (session as { apiTokens?: ILoginData } | undefined)?.apiTokens;
			if (trigger === "update" && apiTokens) {
				// Only accept tokens issued to the user this session belongs to
				const sameUser = getJwtSubject(apiTokens.access_token) === token.id;
				return sameUser ? withApiTokens(token, apiTokens) : token;
			}

			if (token.error || !token.refreshToken) {
				return token;
			}
			if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - REFRESH_MARGIN_MS) {
				return token;
			}

			try {
				return withApiTokens(token, await authService.refresh(token.refreshToken as string));
			} catch (error) {
				// Transient failures (5xx, network): keep the tokens so the next request retries
				if (!(error instanceof HttpStatusError && error.statusCode === 401)) {
					return token;
				}
				// Revoked or expired session: drop the tokens so nothing retries with them
				return {
					...token,
					accessToken: undefined,
					refreshToken: undefined,
					accessTokenExpires: undefined,
					error: "RefreshFailed" as const,
				};
			}
		},
		session({ session, token }) {
			// Expose what the API client needs; the refresh token stays server-side
			// JWT is Record<string, unknown>: these fields are written by the jwt callback above
			session.accessToken = token.accessToken as string | undefined;
			session.error = token.error;
			if (typeof token.id === "string") {
				session.user.id = token.id;
			}
			if (typeof token.username === "string") {
				session.user.username = token.username;
			}
			return session;
		},
	},
	session: {
		strategy: "jwt",
	},
	secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(authConfig);
