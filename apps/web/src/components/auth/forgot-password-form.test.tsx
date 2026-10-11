import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password-form";

const mockForgot = vi.fn();
vi.mock("@/apis", () => ({
	authApi: { forgotPassword: (...args: unknown[]) => mockForgot(...args) },
	HttpStatusError: class extends Error {},
}));

describe("ForgotPasswordForm", () => {
	beforeEach(() => {
		mockForgot.mockReset();
	});

	it("shows the neutral confirmation after submitting", async () => {
		mockForgot.mockResolvedValue({});
		render(<ForgotPasswordForm />);

		fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.co" } });
		fireEvent.click(screen.getByRole("button", { name: "submit" }));

		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("sent"));
		expect(mockForgot).toHaveBeenCalledWith({ email: "a@b.co", locale: "en" });
	});

	it("shows the same confirmation when the request fails", async () => {
		mockForgot.mockRejectedValue(new Error("boom"));
		render(<ForgotPasswordForm />);

		fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.co" } });
		fireEvent.click(screen.getByRole("button", { name: "submit" }));

		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("sent"));
	});

	it("validates the email", async () => {
		render(<ForgotPasswordForm />);

		fireEvent.change(screen.getByLabelText("email"), { target: { value: "nope" } });
		fireEvent.click(screen.getByRole("button", { name: "submit" }));

		await waitFor(() => expect(screen.getByText("validation.invalidEmail")).toBeInTheDocument());
		expect(mockForgot).not.toHaveBeenCalled();
	});
});
