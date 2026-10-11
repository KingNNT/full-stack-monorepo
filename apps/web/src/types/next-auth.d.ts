/**
 * NextAuth type augmentation for the API session fields
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
	interface User {
		username?: string;
		accessToken?: string;
		refreshToken?: string;
	}

	interface Session {
		accessToken?: string;
		error?: "RefreshFailed";
		user: {
			id: string;
			username?: string;
		} & DefaultSession["user"];
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		accessTokenExpires?: number;
		error?: "RefreshFailed";
	}
}
