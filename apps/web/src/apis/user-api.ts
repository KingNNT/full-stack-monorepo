/**
 * User API
 * User profile and account management endpoints
 */

import type { IUser } from "@/types/user";
import { BaseApi } from "./base-api";

/**
 * User API service
 * Handles user profile operations
 */
export class UserApi extends BaseApi {
	/**
	 * Constructor
	 */
	constructor() {
		super("/api/v1/users");
	}

	/**
	 * Get current user profile
	 * @returns User profile data
	 *
	 * @example
	 * const user = await userApi.getProfile();
	 */
	async getProfile(): Promise<IUser> {
		return this.get<IUser>(this.buildUrl("/profile"));
	}

	/**
	 * Update user profile
	 * @param data - Partial user data to update
	 * @returns Updated user profile
	 *
	 * @example
	 * const updatedUser = await userApi.updateProfile({
	 *   name: 'John Smith'
	 * });
	 */
	async updateProfile(data: Partial<IUser>): Promise<IUser> {
		return this.put<IUser>(this.buildUrl("/profile"), data);
	}

	/**
	 * Change user password
	 * @param oldPassword - Current password
	 * @param newPassword - New password
	 * @returns Void
	 *
	 * @example
	 * await userApi.changePassword('oldpass123', 'newpass456');
	 */
	async changePassword(oldPassword: string, newPassword: string): Promise<void> {
		return this.post<void>(this.buildUrl("/change-password"), {
			oldPassword,
			newPassword,
		});
	}
}
