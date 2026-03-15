import type { RenderOptions } from "@testing-library/react";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/**
 * Provider wrapper for component tests.
 *
 * next-intl, next-auth, and next/navigation are mocked at the module level
 * (see tests/helpers/mocks/). This wrapper provides any remaining
 * context providers needed at render time.
 */
function TestProviders({ children }: { children: ReactNode }) {
	return <>{children}</>;
}

/**
 * Custom render function with providers.
 *
 * Usage:
 *   import { renderWithProviders } from "../../../tests/helpers/test-utils";
 *   renderWithProviders(<MyComponent />);
 */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
	return render(ui, { wrapper: TestProviders, ...options });
}

export * from "@testing-library/react";
export { renderWithProviders as render };
