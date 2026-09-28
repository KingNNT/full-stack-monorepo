/**
 * Auth API
 * Authentication endpoints
 */

import type { ILoginData, ILoginRequest, IRegisterData, IRegisterRequest } from "@/types/auth";
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
}
