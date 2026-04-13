/**
 * User API
 * User profile and account management endpoints
 */

import type { IChangePasswordRequest, IUpdateProfileRequest, IUserProfile } from "@/types/user";
import { BaseApi } from "./base-api";

export class UserApi extends BaseApi {
	constructor() {
		super("/api/v1/users");
	}

	async getProfile(): Promise<IUserProfile> {
		return this.get<IUserProfile>(this.buildUrl("/profile"));
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
