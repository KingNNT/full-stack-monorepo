/**
 * Custom authentication exceptions
 * Services throw these exceptions, and API handlers convert them to responses
 */

import type { TAuthServiceErrorCode } from "@/constants/error-codes";
import { AUTH_SERVICE_ERROR_CODES } from "@/constants/error-codes";

/**
 * Base authentication exception class
 */
export class AuthException extends Error {
	constructor(
		message: string,
		public readonly code: TAuthServiceErrorCode,
		public readonly statusCode: number = 400,
	) {
		super(message);
		this.name = "AuthException";
		Object.setPrototypeOf(this, AuthException.prototype);
	}
}

/**
 * Exception thrown when required credentials are missing
 */
export class MissingCredentialsException extends AuthException {
	constructor(message = "Required credentials are missing") {
		super(message, AUTH_SERVICE_ERROR_CODES.MISSING_CREDENTIALS, 400);
		this.name = "MissingCredentialsException";
	}
}

/**
 * Exception thrown when email format is invalid
 */
export class InvalidEmailException extends AuthException {
	constructor(message = "Invalid email format") {
		super(message, AUTH_SERVICE_ERROR_CODES.INVALID_EMAIL, 400);
		this.name = "InvalidEmailException";
	}
}

/**
 * Exception thrown when password format is invalid
 */
export class InvalidPasswordException extends AuthException {
	constructor(message = "Invalid password format") {
		super(message, AUTH_SERVICE_ERROR_CODES.INVALID_PASSWORD, 400);
		this.name = "InvalidPasswordException";
	}
}

/**
 * Exception thrown when credentials are invalid (wrong email/password)
 */
export class InvalidCredentialsException extends AuthException {
	constructor(message = "Invalid credentials") {
		super(message, AUTH_SERVICE_ERROR_CODES.INVALID_CREDENTIALS, 401);
		this.name = "InvalidCredentialsException";
	}
}

/**
 * Exception thrown when email already exists during registration
 */
export class EmailExistsException extends AuthException {
	constructor(message = "An account with this email already exists") {
		super(message, AUTH_SERVICE_ERROR_CODES.EMAIL_EXISTS, 409);
		this.name = "EmailExistsException";
	}
}

/**
 * Exception thrown when name is invalid
 */
export class InvalidNameException extends AuthException {
	constructor(message = "Invalid name") {
		super(message, AUTH_SERVICE_ERROR_CODES.INVALID_NAME, 400);
		this.name = "InvalidNameException";
	}
}

/**
 * Exception thrown for internal server errors
 */
export class InternalAuthException extends AuthException {
	constructor(message = "An internal error occurred") {
		super(message, AUTH_SERVICE_ERROR_CODES.INTERNAL_ERROR, 500);
		this.name = "InternalAuthException";
	}
}
