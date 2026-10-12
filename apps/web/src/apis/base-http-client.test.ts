import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpStatusError } from "./errors";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	getCsrfToken: vi.fn(),
	signOut: vi.fn(),
}));

vi.mock("next-auth/react", () => mocks);
vi.mock("@/configs/api.config", () => ({
	apiConfig: {
		baseUrl: "http://api.test",
		timeout: 1000,
		maxRetries: 0,
		retryDelay: 0,
		retryBackoffMultiplier: 1,
		headers: { "Content-Type": "application/json" },
	},
}));

const { BaseHttpClient } = await import("./base-http-client");

const json = (status: number, body: object) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
const ok = (data: object) => json(200, { status_code: 200, success: true, message: "", data });
const unauthorized = (error = "UNAUTHORIZED") =>
	json(401, { status_code: 401, success: false, message: "", error });

const fetchMock = vi.fn();
const apiCalls = () => fetchMock.mock.calls.filter(([input]) => input instanceof Request);
const sessionRefreshes = () =>
	fetchMock.mock.calls.filter(([input]) => input === "/api/auth/session");

// Route the session endpoint to `refreshed`, every API call to the next queued response
const respond = (apiResponses: Response[], refreshed: object | null = null) => {
	fetchMock.mockImplementation(async (input: RequestInfo) => {
		if (input === "/api/auth/session") return json(200, refreshed ?? {});
		return apiResponses.shift() ?? ok({});
	});
};

describe("BaseHttpClient", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
		mocks.getSession.mockResolvedValue({ accessToken: "old" });
		mocks.getCsrfToken.mockResolvedValue("csrf");
		mocks.signOut.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("forces a session refresh and retries once when the access token is rejected", async () => {
		respond([unauthorized(), ok({ id: 1 })], { accessToken: "new" });
		mocks.getSession.mockResolvedValueOnce({ accessToken: "old" });
		mocks.getSession.mockResolvedValueOnce({ accessToken: "new" });

		await expect(new BaseHttpClient().get("users/me")).resolves.toEqual({ id: 1 });

		const [, init] = sessionRefreshes()[0];
		expect(JSON.parse(init.body)).toEqual({ csrfToken: "csrf", data: { forceRefresh: true } });
		expect(apiCalls()[1][0].headers.get("Authorization")).toBe("Bearer new");
	});

	it("does not retry a second time when the refreshed token is also rejected", async () => {
		respond([unauthorized(), unauthorized()], { accessToken: "new" });

		await expect(new BaseHttpClient().get("users/me")).rejects.toBeInstanceOf(HttpStatusError);
		expect(apiCalls()).toHaveLength(2);
		expect(sessionRefreshes()).toHaveLength(1);
	});

	it("shares one session refresh between parallel rejected requests", async () => {
		respond([unauthorized(), unauthorized()], { accessToken: "new" });
		const client = new BaseHttpClient();

		await Promise.all([client.get("a"), client.get("b")]);

		expect(sessionRefreshes()).toHaveLength(1);
	});

	it("signs out when the session can no longer be refreshed", async () => {
		respond([unauthorized()], { error: "RefreshFailed" });

		await expect(new BaseHttpClient().get("users/me")).rejects.toBeInstanceOf(HttpStatusError);
		expect(apiCalls()).toHaveLength(1);
		expect(mocks.signOut).toHaveBeenCalledWith({
			callbackUrl: "/en/login?reason=session_expired",
		});
	});

	it("does not refresh for a 401 that is not about the access token", async () => {
		respond([unauthorized("INVALID_CREDENTIALS")]);

		await expect(new BaseHttpClient().post("auth/login", {})).rejects.toBeInstanceOf(
			HttpStatusError,
		);
		expect(sessionRefreshes()).toHaveLength(0);
	});

	it("does not refresh when the caller supplied its own token", async () => {
		respond([unauthorized()]);

		await expect(
			new BaseHttpClient().get("users/me", { headers: { Authorization: "Bearer explicit" } }),
		).rejects.toBeInstanceOf(HttpStatusError);
		expect(sessionRefreshes()).toHaveLength(0);
	});
});
