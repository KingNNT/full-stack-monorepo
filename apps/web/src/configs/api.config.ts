/**
 * API Client Configuration
 * Centralized configuration for all API requests
 */

export interface ApiConfig {
	/**
	 * Base URL for API requests
	 * @default process.env.NEXT_PUBLIC_API_BASE_URL || ''
	 */
	baseUrl: string;

	/**
	 * Request timeout in milliseconds
	 * @default 30000 (30 seconds)
	 */
	timeout: number;

	/**
	 * Maximum number of retry attempts for failed requests
	 * @default 3
	 */
	maxRetries: number;

	/**
	 * Initial delay in milliseconds before first retry
	 * @default 1000 (1 second)
	 */
	retryDelay: number;

	/**
	 * Exponential backoff multiplier for retries
	 * Delay calculation: retryDelay × (multiplier ^ attempt)
	 * @default 2
	 */
	retryBackoffMultiplier: number;

	/**
	 * Default headers to include in all requests
	 */
	headers: Record<string, string>;
}

/**
 * API client configuration instance
 * Reads from environment variables with sensible defaults
 */
export const apiConfig: ApiConfig = {
	baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "",
	timeout: Number(process.env.NEXT_PUBLIC_API_TIMEOUT) || 30_000,
	maxRetries: Number(process.env.NEXT_PUBLIC_API_MAX_RETRIES) || 3,
	retryDelay: Number(process.env.NEXT_PUBLIC_API_RETRY_DELAY) || 1000,
	retryBackoffMultiplier: Number(process.env.NEXT_PUBLIC_API_RETRY_BACKOFF) || 2,
	headers: {
		"Content-Type": "application/json",
	},
};
