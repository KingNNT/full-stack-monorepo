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
		user: {
			id: string;
			username?: string;
		} & DefaultSession["user"];
	}
}
