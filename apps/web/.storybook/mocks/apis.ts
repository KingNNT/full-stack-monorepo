import { fn } from "storybook/test";

export const authApi = {
	register: fn().mockName("authApi.register").mockResolvedValue({ success: true }),
	login: fn().mockName("authApi.login").mockResolvedValue({ success: true }),
	logout: fn().mockName("authApi.logout").mockResolvedValue(undefined),
	refreshToken: fn().mockName("authApi.refreshToken").mockResolvedValue({ access_token: "" }),
};

export const userApi = {
	getProfile: fn().mockName("userApi.getProfile").mockResolvedValue({}),
	updateProfile: fn().mockName("userApi.updateProfile").mockResolvedValue({}),
	changePassword: fn().mockName("userApi.changePassword").mockResolvedValue(undefined),
};

export class ApiClientException extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ApiClientException";
	}
}

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
	}
}

export class NetworkError extends ApiClientException {
	constructor(message = "Network request failed") {
		super(message);
		this.name = "NetworkError";
	}
}

export class TimeoutError extends ApiClientException {
	public readonly duration: number;
	constructor(duration: number, message = "Request timeout") {
		super(`${message} (${duration}ms)`);
		this.name = "TimeoutError";
		this.duration = duration;
	}
}

export class ValidationError extends ApiClientException {
	public readonly errors: Record<string, string[]>;
	constructor(errors: Record<string, string[]>, message = "Validation failed") {
		super(message);
		this.name = "ValidationError";
		this.errors = errors;
	}
}

export class RetryExhaustedError extends ApiClientException {
	public readonly attempts: number;
	public readonly lastError: Error;
	constructor(attempts: number, lastError: Error) {
		super(`Maximum retry attempts (${attempts}) exceeded`);
		this.name = "RetryExhaustedError";
		this.attempts = attempts;
		this.lastError = lastError;
	}
}

// Stub exports for BaseApi and BaseHttpClient to avoid transitive dependency on next-auth/react
export class BaseHttpClient {}
export class BaseApi extends BaseHttpClient {}
export type FetchOptions = Record<string, unknown>;
