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

					// Service now returns user directly or throws exception
					const user = await authService.login(email, password);

					return user;
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
	},
	session: {
		strategy: "jwt",
	},
	secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
