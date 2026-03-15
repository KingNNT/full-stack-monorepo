/**
 * Auth API
 * Authentication endpoints
 */

import type { ILoginData, ILoginRequest, IRegisterData, IRegisterRequest } from "@/types/auth";
import { BaseApi } from "./base-api";

/**
 * Authentication API service
 * Handles login, registration, logout, and token refresh
 */
export class AuthApi extends BaseApi {
	/**
	 * Constructor
	 */
	constructor() {
		super("/api/v1/auth");
	}

	/**
	 * Login with email and password
	 * @param credentials - User credentials (email, password)
	 * @returns Login data with access token, refresh token, and user info
	 *
	 * @example
	 * const result = await authApi.login({
	 *   email: 'user@example.com',
	 *   password: 'password123'
	 * });
	 */
	async login(credentials: ILoginRequest): Promise<ILoginData> {
		return this.post<ILoginData>(this.buildUrl("/login"), credentials);
	}

	/**
	 * Register a new user account
	 * @param data - Registration data (name, email, password)
	 * @returns Registration data with user info
	 *
	 * @example
	 * const result = await authApi.register({
	 *   name: 'John Doe',
	 *   email: 'john@example.com',
	 *   password: 'password123'
	 * });
	 */
	async register(data: IRegisterRequest): Promise<IRegisterData> {
		return this.post<IRegisterData>(this.buildUrl("/register"), data);
	}

	/**
	 * Logout current user
	 * @returns Void
	 *
	 * @example
	 * await authApi.logout();
	 */
	async logout(): Promise<void> {
		return this.post<void>(this.buildUrl("/logout"));
	}

	/**
	 * Refresh access token
	 * @returns New access token
	 *
	 * @example
	 * const { access_token } = await authApi.refreshToken();
	 */
	async refreshToken(): Promise<{ access_token: string }> {
		return this.post<{ access_token: string }>(this.buildUrl("/refresh"));
	}
}
