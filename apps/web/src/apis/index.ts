/**
 * API Client Exports
 * Centralized export for all API service instances
 */

// Import API classes
import { AuthApi } from "./auth-api";
import { UserApi } from "./user-api";

// Export singleton instances
export const authApi = new AuthApi();
export const userApi = new UserApi();

// Export base classes for custom implementations
export { BaseApi } from "./base-api";
// Export types
export type { FetchOptions } from "./base-http-client";
export { BaseHttpClient } from "./base-http-client";
// Export error classes
export * from "./errors";
