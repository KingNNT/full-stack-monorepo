/**
 * Base API Class
 * Base class for all domain-specific API services
 * Provides common functionality and URL building
 */

import { BaseHttpClient } from "./base-http-client";

/**
 * Abstract base class for domain-specific API services
 * Extends BaseHttpClient with domain-specific path management
 */
export abstract class BaseApi extends BaseHttpClient {
	/**
	 * Base path for this API service
	 * @example '/api/v1/auth', '/api/v1/users'
	 */
	protected basePath: string;

	/**
	 * Constructor
	 * @param basePath - Base path for this API service
	 */
	constructor(basePath: string) {
		super();
		this.basePath = basePath;
	}

	/**
	 * Build full URL from endpoint
	 * @param endpoint - Endpoint path (e.g., '/login', '/profile')
	 * @returns Full URL path (without leading slash for ky compatibility)
	 *
	 * @example
	 * // If basePath = '/api/v1/auth'
	 * buildUrl('/login') // returns 'api/v1/auth/login'
	 * buildUrl('login')  // returns 'api/v1/auth/login'
	 */
	protected buildUrl(endpoint: string): string {
		// Ensure endpoint starts with /
		const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
		const fullPath = `${this.basePath}${normalizedEndpoint}`;

		// Remove leading slash for ky compatibility (ky doesn't allow leading slash without prefixUrl)
		return fullPath.startsWith("/") ? fullPath.slice(1) : fullPath;
	}
}
