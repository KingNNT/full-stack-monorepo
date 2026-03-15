/**
 * Route constants for the application
 * Defines which routes require authentication
 */

/**
 * List of route patterns that require authentication
 * Routes matching these patterns will redirect to login if user is not authenticated
 *
 * Patterns:
 * - Exact match: "/dashboard" matches only /en/dashboard or /vi/dashboard
 * - Prefix match: "/settings" matches /en/settings, /en/settings/profile, etc.
 */
export const PRIVATE_ROUTES = [
	"/dashboard",
	"/settings",
	"/profile",
	// Add more private routes here as your app grows
] as const;

/**
 * List of route patterns that are public (don't require authentication)
 * These are explicitly public even if they might match private patterns
 */
export const PUBLIC_ROUTES = [
	"/home",
	"/login",
	"/register",
	"/forgot-password",
	// Add more public routes here
] as const;
