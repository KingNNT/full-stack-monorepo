/**
 * NextAuth type augmentation for the API session fields
 */

import type { DefaultSession } from "next-auth";
import type { ILoginData } from "@/types/auth";

declare module "next-auth" {
	interface User {
		username?: string;
		accessToken?: string;
		refreshToken?: string;
	}

	interface Session {
		accessToken?: string;
		/** Input-only for server-side unstable_update(); never present on a read session */
		apiTokens?: ILoginData;
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
