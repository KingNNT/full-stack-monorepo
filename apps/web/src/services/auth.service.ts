/**
 * Authentication service
 * Handles authentication business logic by delegating to the API backend
 * Throws exceptions on errors - API layer handles exception to response conversion
 */

import { authApi, userApi } from "@/apis";
import { HttpStatusError } from "@/apis/errors";
import {
	EmailExistsException,
	InvalidCredentialsException,
	InvalidEmailException,
	InvalidPasswordException,
	InvalidUsernameException,
	MissingCredentialsException,
} from "@/exceptions";
import type { IAuthenticatedUser, IRegisterData } from "@/types/auth";

const PASSWORD_MIN_LENGTH = 8;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * AuthService class
 * Provides authentication-related operations via API backend
 */
export class AuthService {
	/**
	 * Validates email format
	 */
	validateEmailFormat(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	/**
	 * Validates password requirements (mirrors the API rule)
	 */
	validatePasswordFormat(password: string): boolean {
		return password.length >= PASSWORD_MIN_LENGTH;
	}

	/**
	 * Validates username format (mirrors the API rule)
	 */
	validateUsernameFormat(username: string): boolean {
		return USERNAME_REGEX.test(username);
	}

	/**
	 * Authenticates a user with email and password
	 *
	 * @param email - User's email address
	 * @param password - User's password
	 * @returns The user's profile plus API tokens if credentials are valid
	 * @throws {MissingCredentialsException} If email or password is missing
	 * @throws {InvalidEmailException} If email format is invalid
	 * @throws {InvalidPasswordException} If password format is invalid
	 * @throws {InvalidCredentialsException} If credentials don't match
	 */
	async login(email: string, password: string): Promise<IAuthenticatedUser> {
		if (!email || !password) {
			throw new MissingCredentialsException("Email and password are required");
		}

		if (!this.validateEmailFormat(email)) {
			throw new InvalidEmailException("Invalid email format");
		}

		if (!this.validatePasswordFormat(password)) {
			throw new InvalidPasswordException("Password must be at least 8 characters");
		}

		try {
			const tokens = await authApi.login({ identifier: email, password });
			const profile = await userApi.getProfile({
				headers: { Authorization: `Bearer ${tokens.access_token}` },
			});

			return {
				id: profile.user_id,
				email: profile.email,
				username: profile.username,
				accessToken: tokens.access_token,
				refreshToken: tokens.refresh_token,
			};
		} catch (error) {
			if (error instanceof HttpStatusError && error.statusCode === 401) {
				throw new InvalidCredentialsException("Invalid email or password");
			}
			throw error;
		}
	}

	/**
	 * Registers a new user account
	 *
	 * @param username - Username (3-30 letters, numbers or underscores)
	 * @param email - User's email address
	 * @param password - User's password
	 * @returns The created user's ID
	 * @throws {MissingCredentialsException} If any required field is missing
	 * @throws {InvalidUsernameException} If username format is invalid
	 * @throws {InvalidEmailException} If email format is invalid
	 * @throws {InvalidPasswordException} If password format is invalid
	 * @throws {EmailExistsException} If email or username is already registered
	 */
	async register(username: string, email: string, password: string): Promise<IRegisterData> {
		if (!username || !email || !password) {
			throw new MissingCredentialsException("Username, email and password are required");
		}

		if (!this.validateUsernameFormat(username)) {
			throw new InvalidUsernameException(
				"Username must be 3-30 characters: letters, numbers or underscores",
			);
		}

		if (!this.validateEmailFormat(email)) {
			throw new InvalidEmailException("Invalid email format");
		}

		if (!this.validatePasswordFormat(password)) {
			throw new InvalidPasswordException("Password must be at least 8 characters");
		}

		try {
			return await authApi.register({ username, email, password });
		} catch (error) {
			if (error instanceof HttpStatusError && error.statusCode === 409) {
				throw new EmailExistsException("An account with this email or username already exists");
			}
			throw error;
		}
	}
}

// Export singleton instance
export const authService = new AuthService();
