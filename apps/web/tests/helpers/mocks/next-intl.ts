import enMessages from "@/langs/en.json";

/**
 * Resolves a dot-separated key path through a nested object.
 */
function resolvePath(obj: Record<string, unknown>, keyPath: string): unknown {
	const parts = keyPath.split(".");
	let current: unknown = obj;
	for (const part of parts) {
		if (typeof current !== "object" || current === null) return keyPath;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

/**
 * Creates a translation function backed by en.json.
 */
export function makeT(namespace: string) {
	return (key: string) => {
		const namespaceObj = resolvePath(enMessages as unknown as Record<string, unknown>, namespace);
		if (typeof namespaceObj === "object" && namespaceObj !== null) {
			const result = resolvePath(namespaceObj as Record<string, unknown>, key);
			return typeof result === "string" ? result : `${namespace}.${key}`;
		}
		return `${namespace}.${key}`;
	};
}

/**
 * Returns a mock factory for next-intl.
 *
 * Usage in test files:
 *   vi.mock("next-intl", () => createNextIntlMock());
 */
export function createNextIntlMock(locale = "en") {
	return {
		useTranslations: (namespace: string) => makeT(namespace),
		useLocale: () => locale,
	};
}
