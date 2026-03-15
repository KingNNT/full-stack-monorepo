/**
 * Authentication service
 * Handles authentication business logic by delegating to the API backend
 * Throws exceptions on errors - API layer handles exception to response conversion
 */

import { authApi } from "@/apis";
import { HttpStatusError } from "@/apis/errors";
import {
	EmailExistsException,
	InvalidCredentialsException,
	InvalidEmailException,
	InvalidNameException,
	InvalidPasswordException,
	MissingCredentialsException,
} from "@/exceptions";
import type { IUser } from "@/types/user";

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
	 * Validates password requirements
	 */
	validatePasswordFormat(password: string): boolean {
		return password.length >= 6;
	}

	/**
	 * Authenticates a user with email and password
	 *
	 * @param email - User's email address
	 * @param password - User's password
	 * @returns User data if credentials are valid
	 * @throws {MissingCredentialsException} If email or password is missing
	 * @throws {InvalidEmailException} If email format is invalid
	 * @throws {InvalidPasswordException} If password format is invalid
	 * @throws {InvalidCredentialsException} If credentials don't match
	 */
	async login(email: string, password: string): Promise<IUser> {
		if (!email || !password) {
			throw new MissingCredentialsException("Email and password are required");
		}

		if (!this.validateEmailFormat(email)) {
			throw new InvalidEmailException("Invalid email format");
		}

		if (!this.validatePasswordFormat(password)) {
			throw new InvalidPasswordException("Password must be at least 6 characters");
		}

		try {
			const result = await authApi.login({ email, password });
			return result.user;
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
	 * @param name - User's full name
	 * @param email - User's email address
	 * @param password - User's password
	 * @returns Created user data
	 * @throws {MissingCredentialsException} If any required field is missing
	 * @throws {InvalidNameException} If name is too short
	 * @throws {InvalidEmailException} If email format is invalid
	 * @throws {InvalidPasswordException} If password format is invalid
	 * @throws {EmailExistsException} If email is already registered
	 */
	async register(name: string, email: string, password: string): Promise<IUser> {
		if (!name || !email || !password) {
			throw new MissingCredentialsException("Name, email and password are required");
		}

		if (name.trim().length < 2) {
			throw new InvalidNameException("Name must be at least 2 characters");
		}

		if (!this.validateEmailFormat(email)) {
			throw new InvalidEmailException("Invalid email format");
		}

		if (!this.validatePasswordFormat(password)) {
			throw new InvalidPasswordException("Password must be at least 6 characters");
		}

		try {
			const result = await authApi.register({ name, email, password });
			return result.user;
		} catch (error) {
			if (error instanceof HttpStatusError && error.statusCode === 409) {
				throw new EmailExistsException("An account with this email already exists");
			}
			throw error;
		}
	}
}

// Export singleton instance
export const authService = new AuthService();
