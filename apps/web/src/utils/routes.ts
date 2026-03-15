/**
 * Route configuration for the application
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

/**
 * Check if a pathname (without locale) requires authentication
 * @param pathname - The pathname without locale prefix (e.g., "/dashboard" not "/en/dashboard")
 * @returns true if the route requires authentication
 */
export function isPrivateRoute(pathname: string): boolean {
	// First check if it's explicitly public
	for (const publicRoute of PUBLIC_ROUTES) {
		if (pathname === publicRoute || pathname.startsWith(`${publicRoute}/`)) {
			return false;
		}
	}

	// Then check if it's private
	for (const privateRoute of PRIVATE_ROUTES) {
		if (pathname === privateRoute || pathname.startsWith(`${privateRoute}/`)) {
			return true;
		}
	}

	// Default: public
	return false;
}

/**
 * Check if a pathname is a public route
 * @param pathname - The pathname without locale prefix
 * @returns true if the route is public
 */
export function isPublicRoute(pathname: string): boolean {
	for (const publicRoute of PUBLIC_ROUTES) {
		if (pathname === publicRoute || pathname.startsWith(`${publicRoute}/`)) {
			return true;
		}
	}
	return false;
}
