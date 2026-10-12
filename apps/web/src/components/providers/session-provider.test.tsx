import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockNextAuthProvider = vi.hoisted(() =>
	vi.fn(({ children }: { children: React.ReactNode }) => children),
);

vi.mock("next-auth/react", () => ({ SessionProvider: mockNextAuthProvider }));

const { SessionProvider } = await import("./session-provider");

describe("SessionProvider", () => {
	it("refetches the session periodically so idle tabs keep their API tokens fresh", () => {
		render(<SessionProvider>content</SessionProvider>);

		expect(mockNextAuthProvider.mock.calls[0][0]).toMatchObject({ refetchInterval: 60 });
	});
});
