// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/server", () => ({ NextResponse: { json: vi.fn() }, userAgent: vi.fn() }));
vi.mock("@/utils/logger", () => ({ default: { error: vi.fn() } }));

const { redactHeaders } = await import("@/utils/api-routes");

describe("redactHeaders", () => {
	it("redacts cookies and authorization headers", () => {
		const headers = redactHeaders([
			["cookie", "authjs.session-token=secret"],
			["Authorization", "Bearer secret"],
		]);

		expect(JSON.stringify(headers)).not.toContain("secret");
	});

	it("keeps non-sensitive headers", () => {
		expect(redactHeaders([["user-agent", "curl/8"]])).toEqual({ "user-agent": "curl/8" });
	});
});
