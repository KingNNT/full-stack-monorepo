// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_SERVICE_ERROR_CODES } from "@/constants/error-codes";
import { InvalidEmailException, MissingCredentialsException } from "@/exceptions";

// Mock next/server
vi.mock("next/server", () => ({
	NextResponse: {
		json: (body: unknown, init?: { status?: number }) => ({
			body,
			status: init?.status ?? 200,
			json: async () => body,
		}),
	},
}));

// Mock logger to suppress output
vi.mock("@/utils/logger", () => ({
	default: { error: vi.fn(), log: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// Import after mocks
const { handleApiError } = await import("@/utils/api-error-handler");

describe("handleApiError", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("handles AuthException with correct status code and error code", () => {
		const error = new MissingCredentialsException("Missing fields");
		const response = handleApiError(error) as unknown as {
			status: number;
			body: Record<string, unknown>;
		};

		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({
			status_code: 400,
			success: false,
			message: "Missing fields",
			error: AUTH_SERVICE_ERROR_CODES.MISSING_CREDENTIALS,
		});
	});

	it("handles InvalidEmailException with 400 status", () => {
		const error = new InvalidEmailException("Bad email");
		const response = handleApiError(error) as unknown as {
			status: number;
			body: Record<string, unknown>;
		};

		expect(response.status).toBe(400);
		expect(response.body.error).toBe(AUTH_SERVICE_ERROR_CODES.INVALID_EMAIL);
	});

	it("includes errorTraceId when includeTraceId is true", () => {
		const error = new MissingCredentialsException();
		const response = handleApiError(error, true) as unknown as {
			status: number;
			body: Record<string, unknown>;
		};

		expect(response.body.errorTraceId).toBeDefined();
		expect(typeof response.body.errorTraceId).toBe("string");
	});

	it("omits errorTraceId when includeTraceId is false", () => {
		const error = new MissingCredentialsException();
		const response = handleApiError(error, false) as unknown as {
			status: number;
			body: Record<string, unknown>;
		};

		expect(response.body.errorTraceId).toBeUndefined();
	});

	it("handles generic Error with 500 status", () => {
		const error = new Error("Something broke");
		const response = handleApiError(error) as unknown as {
			status: number;
			body: Record<string, unknown>;
		};

		expect(response.status).toBe(500);
		expect(response.body).toMatchObject({
			status_code: 500,
			success: false,
			message: "Something broke",
			error: AUTH_SERVICE_ERROR_CODES.INTERNAL_ERROR,
		});
	});

	it("handles unknown error types with 500 status", () => {
		const response = handleApiError("string error") as unknown as {
			status: number;
			body: Record<string, unknown>;
		};

		expect(response.status).toBe(500);
		expect(response.body).toMatchObject({
			status_code: 500,
			success: false,
			message: "An unexpected error occurred",
			error: AUTH_SERVICE_ERROR_CODES.INTERNAL_ERROR,
		});
	});
});
