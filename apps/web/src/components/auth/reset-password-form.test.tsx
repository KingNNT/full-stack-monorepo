import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "./reset-password-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const fill = (password: string, confirm = password) => {
	fireEvent.change(screen.getByLabelText("password"), { target: { value: password } });
	fireEvent.change(screen.getByLabelText("confirmPassword"), { target: { value: confirm } });
	fireEvent.click(screen.getByRole("button", { name: "submit" }));
};

describe("ResetPasswordForm", () => {
	afterEach(() => vi.restoreAllMocks());

	it("posts token and password, then goes to login with a banner", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
		render(<ResetPasswordForm token="tok" />);

		fill("newPass123");

		await waitFor(() => expect(push).toHaveBeenCalledWith("/en/login?reason=password_reset"));
		expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
			token: "tok",
			password: "newPass123",
			locale: "en",
		});
	});

	it("explains an invalid or expired link", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ error: "INVALID_RESET_TOKEN" }), { status: 400 }),
		);
		render(<ResetPasswordForm token="tok" />);

		fill("newPass123");

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("invalidToken"));
	});

	it("requires matching passwords", async () => {
		render(<ResetPasswordForm token="tok" />);

		fill("newPass123", "different1");

		await waitFor(() =>
			expect(screen.getByText("validation.passwordsNotMatch")).toBeInTheDocument(),
		);
	});

	it("shows the invalid-link message without a token", () => {
		render(<ResetPasswordForm token={null} />);

		expect(screen.getByRole("alert")).toHaveTextContent("invalidToken");
	});
});
