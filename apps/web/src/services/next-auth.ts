import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { AuthException } from "@/exceptions";
import { authService } from "./auth.service";

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
		jwt({ token, user }) {
			// `user` is only set on sign-in: keep the API tokens in the encrypted JWT cookie
			if (user) {
				token.id = user.id;
				token.username = user.username;
				token.accessToken = user.accessToken;
				token.refreshToken = user.refreshToken;
			}
			return token;
		},
		session({ session, token }) {
			// Expose what the API client needs; the refresh token stays server-side
			// JWT is Record<string, unknown>: these fields are written by the jwt callback above
			session.accessToken = token.accessToken as string | undefined;
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

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
