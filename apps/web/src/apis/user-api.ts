/**
 * User API
 * User profile and account management endpoints
 */

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

	async changePassword(oldPassword: string, newPassword: string): Promise<void> {
		const body: IChangePasswordRequest = {
			old_password: oldPassword,
			new_password: newPassword,
		};
		return this.post<void>(this.buildUrl("/change-password"), body);
	}
}
