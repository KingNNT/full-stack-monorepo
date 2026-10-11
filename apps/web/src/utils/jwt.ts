/**
 * Reads the `exp` claim of a JWT without verifying it (the API verifies tokens).
 * @returns Expiry in milliseconds since epoch, or null when it cannot be read
 */
export function getJwtExpiry(token: string): number | null {
	const payload = token.split(".")[1];
	if (!payload) return null;
	try {
		const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
			exp?: unknown;
		};
		return typeof exp === "number" ? exp * 1000 : null;
	} catch {
		return null;
	}
}
