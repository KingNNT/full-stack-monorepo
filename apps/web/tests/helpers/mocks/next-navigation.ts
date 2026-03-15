import { vi } from "vitest";

interface MockNavigationOptions {
	searchParams?: Record<string, string>;
	pathname?: string;
}

/**
 * Returns a mock factory for next/navigation.
 *
 * Usage in test files:
 *   const { pushMock, factory } = createNextNavigationMocks();
 *   vi.mock("next/navigation", () => factory);
 */
export function createNextNavigationMocks(overrides: MockNavigationOptions = {}) {
	const pushMock = vi.fn();
	const replaceMock = vi.fn();
	const refreshMock = vi.fn();

	const factory = {
		useRouter: () => ({
			push: pushMock,
			replace: replaceMock,
			refresh: refreshMock,
			back: vi.fn(),
			forward: vi.fn(),
			prefetch: vi.fn(),
		}),
		useSearchParams: () => ({
			get: (key: string) => overrides.searchParams?.[key] ?? null,
		}),
		usePathname: () => overrides.pathname ?? "/en/home",
	};

	return { pushMock, replaceMock, refreshMock, factory };
}
