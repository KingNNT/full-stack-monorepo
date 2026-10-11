// Decodes a JWT payload without verifying it (the API verifies tokens)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
	const payload = token.split(".")[1];
	if (!payload) return null;
	try {
		const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
		return typeof claims === "object" && claims !== null
			? (claims as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

/**
 * Reads the `exp` claim of a JWT without verifying it (the API verifies tokens).
 * @returns Expiry in milliseconds since epoch, or null when it cannot be read
 */
export function getJwtExpiry(token: string): number | null {
	const exp = decodeJwtPayload(token)?.exp;
	return typeof exp === "number" ? exp * 1000 : null;
}

/**
 * Reads the `sub` claim of a JWT without verifying it (the API verifies tokens).
 * @returns The subject (user id), or null when it cannot be read
 */
export function getJwtSubject(token: string): string | null {
	const sub = decodeJwtPayload(token)?.sub;
	return typeof sub === "string" ? sub : null;
}
