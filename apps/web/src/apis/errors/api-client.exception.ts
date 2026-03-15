/**
 * API Client Exception Classes
 * Custom exceptions for client-side API errors
 */

/**
 * Base exception class for all API client errors
 */
export class ApiClientException extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ApiClientException";
		Object.setPrototypeOf(this, ApiClientException.prototype);
	}
}

/**
 * Network error - connection failures, CORS errors, etc.
 */
export class NetworkError extends ApiClientException {
	constructor(message: string = "Network request failed") {
		super(message);
		this.name = "NetworkError";
		Object.setPrototypeOf(this, NetworkError.prototype);
	}
}

/**
 * Timeout error - request exceeded timeout duration
 */
export class TimeoutError extends ApiClientException {
	public readonly duration: number;

	constructor(duration: number, message: string = "Request timeout") {
		super(`${message} (${duration}ms)`);
		this.name = "TimeoutError";
		this.duration = duration;
		Object.setPrototypeOf(this, TimeoutError.prototype);
	}
}

/**
 * HTTP status error - server returned error status code
 */
export class HttpStatusError extends ApiClientException {
	public readonly statusCode: number;
	public readonly statusText: string;
	public readonly response?: unknown;

	constructor(statusCode: number, statusText: string, response?: unknown) {
		super(`HTTP ${statusCode}: ${statusText}`);
		this.name = "HttpStatusError";
		this.statusCode = statusCode;
		this.statusText = statusText;
		this.response = response;
		Object.setPrototypeOf(this, HttpStatusError.prototype);
	}
}

/**
 * Validation error - client-side validation failure
 */
export class ValidationError extends ApiClientException {
	public readonly errors: Record<string, string[]>;

	constructor(errors: Record<string, string[]>, message: string = "Validation failed") {
		super(message);
		this.name = "ValidationError";
		this.errors = errors;
		Object.setPrototypeOf(this, ValidationError.prototype);
	}
}

/**
 * Retry exhausted error - maximum retry attempts exceeded
 */
export class RetryExhaustedError extends ApiClientException {
	public readonly attempts: number;
	public readonly lastError: Error;

	constructor(attempts: number, lastError: Error) {
		super(`Maximum retry attempts (${attempts}) exceeded`);
		this.name = "RetryExhaustedError";
		this.attempts = attempts;
		this.lastError = lastError;
		Object.setPrototypeOf(this, RetryExhaustedError.prototype);
	}
}
