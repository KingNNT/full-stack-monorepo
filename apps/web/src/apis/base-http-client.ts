/**
 * Base HTTP Client
 * Core HTTP client using ky with interceptors, retry logic, token injection, and error handling
 */

import ky, { type KyInstance, type Options as KyOptions } from "ky";
import { getSession } from "next-auth/react";
import { apiConfig } from "@/configs/api.config";
import type { ISuccessResponse } from "@/types/api";
import { HttpStatusError, NetworkError, TimeoutError } from "./errors";

/**
 * Fetch options for API requests
 */
export interface FetchOptions {
	/**
	 * Request body data (will be JSON stringified by ky)
	 */
	json?: unknown;

	/**
	 * Request timeout in milliseconds
	 * @default apiConfig.timeout
	 */
	timeout?: number;

	/**
	 * Maximum retry attempts
	 * @default apiConfig.maxRetries
	 */
	retry?: number;

	/**
	 * Additional headers to merge with defaults
	 */
	headers?: Record<string, string>;

	/**
	 * AbortSignal for manual cancellation
	 */
	signal?: AbortSignal;

	/**
	 * Skip automatic auth token injection
	 * @default false
	 */
	skipAuth?: boolean;

	/**
	 * Search parameters to add to URL
	 */
	searchParams?: Record<string, string | number | boolean>;
}

/**
 * Base HTTP Client with advanced features using ky
 * - Request/Response hooks
 * - Automatic auth token injection
 * - Retry logic with exponential backoff (built-in ky)
 * - Request cancellation via AbortController
 * - Timeout support
 * - Error mapping to custom exceptions
 */
export class BaseHttpClient {
	protected client: KyInstance;

	constructor() {
		// Initialize ky client with default configuration
		const clientOptions: Parameters<typeof ky.create>[0] = {
			timeout: apiConfig.timeout,
			retry: {
				limit: apiConfig.maxRetries,
				methods: ["get", "post", "put", "patch", "delete"],
				statusCodes: [408, 413, 429, 500, 502, 503, 504],
				backoffLimit:
					apiConfig.retryDelay * apiConfig.retryBackoffMultiplier ** apiConfig.maxRetries,
			},
			headers: apiConfig.headers,
			hooks: {
				beforeRequest: [
					async (request) => {
						// Inject auth token if available
						const token = await this.getAuthToken();
						if (token) {
							request.headers.set("Authorization", `Bearer ${token}`);
						}
					},
				],
				afterResponse: [
					async (_request, _options, response) => {
						// Handle HTTP errors
						if (!response.ok) {
							const errorData = await response.json().catch(() => ({}));
							throw new HttpStatusError(response.status, response.statusText, errorData);
						}
						return response;
					},
				],
			},
		};

		// Only set prefixUrl if baseUrl is provided
		if (apiConfig.baseUrl) {
			clientOptions.prefixUrl = apiConfig.baseUrl;
		}

		this.client = ky.create(clientOptions);
	}

	/**
	 * Get authentication token from NextAuth session
	 * @returns Access token or null if not available
	 */
	private async getAuthToken(): Promise<string | null> {
		try {
			const session = await getSession();
			// @ts-expect-error - NextAuth session may have accessToken
			return session?.user?.accessToken || session?.accessToken || null;
		} catch {
			return null;
		}
	}

	/**
	 * Build ky options from fetch options
	 * @param options - Fetch options
	 * @returns Ky options
	 */
	private buildKyOptions(options: FetchOptions = {}): KyOptions {
		const { json, timeout, retry, headers, signal, skipAuth, searchParams } = options;

		const kyOptions: KyOptions = {};

		if (json !== undefined) {
			kyOptions.json = json;
		}

		if (timeout !== undefined) {
			kyOptions.timeout = timeout;
		}

		if (retry !== undefined) {
			kyOptions.retry = retry;
		}

		if (headers) {
			kyOptions.headers = headers;
		}

		if (signal) {
			kyOptions.signal = signal;
		}

		if (searchParams) {
			kyOptions.searchParams = searchParams;
		}

		// Override hooks to skip auth if needed
		if (skipAuth) {
			kyOptions.hooks = {
				beforeRequest: [],
			};
		}

		return kyOptions;
	}

	/**
	 * Make HTTP request
	 * @param method - HTTP method
	 * @param url - Request URL
	 * @param options - Fetch options
	 * @returns Parsed response data (unwrapped from ISuccessResponse)
	 */
	protected async request<T>(
		method: "get" | "post" | "put" | "patch" | "delete",
		url: string,
		options: FetchOptions = {},
	): Promise<T> {
		try {
			const kyOptions = this.buildKyOptions(options);
			const response = await this.client[method](url, kyOptions);

			// Parse response as ISuccessResponse
			const apiResponse = await response.json<ISuccessResponse<T>>();

			// Unwrap and return just the data
			return apiResponse.data;
		} catch (error) {
			// Map ky errors to custom exceptions
			if (error instanceof Error) {
				// Timeout error
				if (error.name === "TimeoutError") {
					throw new TimeoutError(options.timeout || apiConfig.timeout);
				}

				// Network error
				if (error.name === "TypeError" || error.message.includes("fetch")) {
					throw new NetworkError("Network request failed. Please check your connection.");
				}

				// Re-throw custom errors (HttpStatusError already thrown in afterResponse hook)
				if (error instanceof HttpStatusError) {
					throw error;
				}
			}

			// Re-throw unknown errors
			throw error;
		}
	}

	/**
	 * Make GET request
	 * @param url - Request URL
	 * @param options - Fetch options
	 * @returns Parsed response data
	 */
	async get<T>(url: string, options?: Omit<FetchOptions, "json">): Promise<T> {
		return this.request<T>("get", url, options);
	}

	/**
	 * Make POST request
	 * @param url - Request URL
	 * @param data - Request body data
	 * @param options - Fetch options
	 * @returns Parsed response data
	 */
	async post<T>(url: string, data?: unknown, options?: Omit<FetchOptions, "json">): Promise<T> {
		return this.request<T>("post", url, { ...options, json: data });
	}

	/**
	 * Make PUT request
	 * @param url - Request URL
	 * @param data - Request body data
	 * @param options - Fetch options
	 * @returns Parsed response data
	 */
	async put<T>(url: string, data?: unknown, options?: Omit<FetchOptions, "json">): Promise<T> {
		return this.request<T>("put", url, { ...options, json: data });
	}

	/**
	 * Make PATCH request
	 * @param url - Request URL
	 * @param data - Request body data
	 * @param options - Fetch options
	 * @returns Parsed response data
	 */
	async patch<T>(url: string, data?: unknown, options?: Omit<FetchOptions, "json">): Promise<T> {
		return this.request<T>("patch", url, { ...options, json: data });
	}

	/**
	 * Make DELETE request
	 * @param url - Request URL
	 * @param options - Fetch options
	 * @returns Parsed response data
	 */
	async delete<T>(url: string, options?: Omit<FetchOptions, "json">): Promise<T> {
		return this.request<T>("delete", url, options);
	}
}
