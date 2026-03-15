// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isPrivateRoute, isPublicRoute } from "@/utils/routes";

describe("isPrivateRoute", () => {
	it("returns true for exact private route matches", () => {
		expect(isPrivateRoute("/dashboard")).toBe(true);
		expect(isPrivateRoute("/settings")).toBe(true);
		expect(isPrivateRoute("/profile")).toBe(true);
	});

	it("returns true for private route sub-paths", () => {
		expect(isPrivateRoute("/dashboard/analytics")).toBe(true);
		expect(isPrivateRoute("/settings/profile")).toBe(true);
	});

	it("returns false for explicit public routes", () => {
		expect(isPrivateRoute("/home")).toBe(false);
		expect(isPrivateRoute("/login")).toBe(false);
		expect(isPrivateRoute("/register")).toBe(false);
		expect(isPrivateRoute("/forgot-password")).toBe(false);
	});

	it("returns false for public route sub-paths", () => {
		expect(isPrivateRoute("/home/section")).toBe(false);
	});

	it("returns false for unknown routes (default public)", () => {
		expect(isPrivateRoute("/about")).toBe(false);
		expect(isPrivateRoute("/contact")).toBe(false);
		expect(isPrivateRoute("/")).toBe(false);
	});
});

describe("isPublicRoute", () => {
	it("returns true for explicitly public routes", () => {
		expect(isPublicRoute("/home")).toBe(true);
		expect(isPublicRoute("/login")).toBe(true);
		expect(isPublicRoute("/register")).toBe(true);
	});

	it("returns true for public route sub-paths", () => {
		expect(isPublicRoute("/home/welcome")).toBe(true);
	});

	it("returns false for private routes", () => {
		expect(isPublicRoute("/dashboard")).toBe(false);
		expect(isPublicRoute("/settings")).toBe(false);
	});

	it("returns false for unknown routes", () => {
		expect(isPublicRoute("/about")).toBe(false);
		expect(isPublicRoute("/")).toBe(false);
	});
});
