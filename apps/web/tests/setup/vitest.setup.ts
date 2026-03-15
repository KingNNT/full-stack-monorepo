import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		replace: vi.fn(),
		refresh: vi.fn(),
		back: vi.fn(),
	}),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/",
	redirect: vi.fn(),
}));

// Mock next-intl
vi.mock("next-intl", () => ({
	useTranslations: () => (key: string) => key,
	useLocale: () => "en",
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
	signIn: vi.fn(),
	signOut: vi.fn(),
	useSession: () => ({ data: null, status: "unauthenticated" }),
}));
