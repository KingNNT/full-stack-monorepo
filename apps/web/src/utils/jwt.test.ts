import { describe, expect, it } from "vitest";
import { getJwtExpiry, getJwtSubject } from "./jwt";

const encode = (payload: object) =>
	`h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

describe("getJwtExpiry", () => {
	it("returns exp in milliseconds", () => {
		expect(getJwtExpiry(encode({ exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
	});

	it("returns null for malformed tokens or a missing exp", () => {
		expect(getJwtExpiry("not-a-jwt")).toBeNull();
		expect(getJwtExpiry(encode({ sub: "1" }))).toBeNull();
	});
});

describe("getJwtSubject", () => {
	it("returns the sub claim", () => {
		expect(getJwtSubject(encode({ sub: "user-1" }))).toBe("user-1");
	});

	it("returns null for malformed tokens or a missing or non-string sub", () => {
		expect(getJwtSubject("not-a-jwt")).toBeNull();
		expect(getJwtSubject("h.%%%.s")).toBeNull();
		expect(getJwtSubject(encode({ exp: 1 }))).toBeNull();
		expect(getJwtSubject(encode({ sub: 1 }))).toBeNull();
	});
});
