/**
 * Auth API
 * Authentication endpoints
 */

import type {
	IForgotPasswordRequest,
	ILoginData,
	ILoginRequest,
	IRegisterData,
	IRegisterRequest,
	IResetPasswordRequest,
} from "@/types/auth";
import { BaseApi } from "./base-api";

/**
 * Authentication API service
 * Handles login and registration
 */
export class AuthApi extends BaseApi {
	/**
	 * Constructor
	 */
	constructor() {
		super("/api/v1/auth");
	}

	/**
	 * Login with email or username + password
	 * @param credentials - User credentials (identifier, password)
	 * @returns Access and refresh tokens
	 *
	 * @example
	 * const result = await authApi.login({
	 *   identifier: 'user@example.com',
	 *   password: 'password123'
	 * });
	 */
	async login(credentials: ILoginRequest): Promise<ILoginData> {
		return this.post<ILoginData>(this.buildUrl("/login"), credentials);
	}

	/**
	 * Register a new user account
	 * @param data - Registration data (username, email, password)
	 * @returns The created user's ID
	 *
	 * @example
	 * const result = await authApi.register({
	 *   username: 'john_doe',
	 *   email: 'john@example.com',
	 *   password: 'password123'
	 * });
	 */
	async register(data: IRegisterRequest): Promise<IRegisterData> {
		return this.post<IRegisterData>(this.buildUrl("/register"), data);
	}

	/**
	 * Exchange a refresh token for a new token pair
	 */
	async refresh(refreshToken: string): Promise<ILoginData> {
		return this.post<ILoginData>(this.buildUrl("/refresh"), undefined, {
			headers: { Authorization: `Bearer ${refreshToken}` },
		});
	}

	/** Request a reset link; the API answers the same for unknown emails */
	async forgotPassword(data: IForgotPasswordRequest): Promise<Record<string, never>> {
		return this.post<Record<string, never>>(this.buildUrl("/forgot-password"), data);
	}

	/** Set a new password with the token from the reset link */
	async resetPassword(data: IResetPasswordRequest): Promise<Record<string, never>> {
		return this.post<Record<string, never>>(this.buildUrl("/reset-password"), data);
	}
}
