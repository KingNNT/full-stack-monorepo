import { NextResponse } from "next/server";
import { defaultLocale, locales, type TLocale } from "@/i18n/config";
import { auth } from "@/services/next-auth";
import { isPrivateRoute } from "@/utils/routes";

export default auth((request) => {
	const url = request.nextUrl;
	const pathname = url.pathname;
	const search = url.search;
	const isLoggedIn = !!request.auth?.user;

	// Helper function to get preferred locale
	function getPreferredLocale(): TLocale {
		// 1. Check for saved locale in cookies
		const cookies = request.cookies;
		const savedLocale = cookies.get("NEXT_LOCALE")?.value;
		if (savedLocale && locales.includes(savedLocale as TLocale)) {
			return savedLocale as TLocale;
		}

		// 2. Check Accept-Language header
		const acceptLanguage = request.headers.get("Accept-Language");
		if (acceptLanguage) {
			const browserLocales = acceptLanguage
				.split(",")
				.map((lang) => lang.split(";")[0].trim().toLowerCase());

			for (const browserLocale of browserLocales) {
				// Check for exact match (e.g., "en" or "vi")
				if (locales.includes(browserLocale as TLocale)) {
					return browserLocale as TLocale;
				}

				// Check for partial match (e.g., "en-US" -> "en")
				const shortLocale = browserLocale.split("-")[0];
				if (locales.includes(shortLocale as TLocale)) {
					return shortLocale as TLocale;
				}
			}
		}

		// 3. Fall back to default locale
		return defaultLocale;
	}

	// Check if the user accessed only the domain (e.g., example.com → redirect to /en/home)
	if (pathname === "/") {
		const preferredLocale = getPreferredLocale();
		const response = NextResponse.redirect(new URL(`/${preferredLocale}/home`, request.url));

		// Set cookie to remember the preference
		response.cookies.set("NEXT_LOCALE", preferredLocale, {
			maxAge: 60 * 60 * 24 * 365, // 1 year
			httpOnly: false,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
		});

		return response;
	}

	// Extract locale from the URL (first segment)
	const pathSegments = pathname.split("/");
	const potentialLocale = pathSegments[1];
	const hasValidLocale = locales.includes(potentialLocale as TLocale);

	if (!hasValidLocale) {
		// Get preferred locale and redirect
		const preferredLocale = getPreferredLocale();
		const newUrl = new URL(`/${preferredLocale}${pathname}${search}`, request.url);
		const response = NextResponse.redirect(newUrl);

		// Set cookie to remember the preference
		response.cookies.set("NEXT_LOCALE", preferredLocale, {
			maxAge: 60 * 60 * 24 * 365, // 1 year
			httpOnly: false,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
		});

		return response;
	}

	// If we have a valid locale, update the cookie if it's different
	const currentLocale = potentialLocale as TLocale;
	const savedLocale = request.cookies.get("NEXT_LOCALE")?.value;

	// Extract the route path without locale (e.g., /en/dashboard -> /dashboard)
	const routeWithoutLocale = `/${pathSegments.slice(2).join("/")}`;

	// Check authentication for private routes
	if (isPrivateRoute(routeWithoutLocale)) {
		if (!isLoggedIn) {
			// Redirect to login page with callback URL
			const loginUrl = new URL(`/${currentLocale}/login`, request.url);
			loginUrl.searchParams.set("callback-url", pathname);
			return NextResponse.redirect(loginUrl);
		}
	}

	// If user is logged in and tries to access login page, redirect to dashboard
	if (routeWithoutLocale === "/login" && isLoggedIn) {
		return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, request.url));
	}

	// Update locale cookie if needed
	if (savedLocale !== currentLocale) {
		const response = NextResponse.next();
		response.cookies.set("NEXT_LOCALE", currentLocale, {
			maxAge: 60 * 60 * 24 * 365, // 1 year
			httpOnly: false,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
		});
		return response;
	}

	// Continue to the requested page
	return NextResponse.next();
});

// See "Matching Paths" below to learn more
export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sitemap.xml, robots.txt (metadata files)
		 */
		`/`,
		`/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)`,
	],
};
