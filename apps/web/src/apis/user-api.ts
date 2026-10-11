/**
 * User API
 * User profile and account management endpoints
 */

import type { ILoginData } from "@/types/auth";
import type { IChangePasswordRequest, IUpdateProfileRequest, IUserProfile } from "@/types/user";
import { BaseApi } from "./base-api";
import type { FetchOptions } from "./base-http-client";

export class UserApi extends BaseApi {
	constructor() {
		super("/api/v1/users");
	}

	async getProfile(options?: Omit<FetchOptions, "json">): Promise<IUserProfile> {
		return this.get<IUserProfile>(this.buildUrl("/profile"), options);
	}

	async updateProfile(data: IUpdateProfileRequest): Promise<IUserProfile> {
		return this.patch<IUserProfile>(this.buildUrl("/profile"), data);
	}

	/**
	 * Change the current user's password
	 * @returns A new token pair; every other session is revoked
	 */
	async changePassword(
		data: IChangePasswordRequest,
		options?: Omit<FetchOptions, "json">,
	): Promise<ILoginData> {
		return this.post<ILoginData>(this.buildUrl("/change-password"), data, options);
	}
}
