import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordForm } from "./change-password-form";

const update = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => ({ update }) }));

const submit = (current: string, next: string, confirm = next) => {
	fireEvent.change(screen.getByLabelText("currentPassword"), { target: { value: current } });
	fireEvent.change(screen.getByLabelText("newPassword"), { target: { value: next } });
	fireEvent.change(screen.getByLabelText("confirmPassword"), { target: { value: confirm } });
	fireEvent.click(screen.getByRole("button", { name: "submit" }));
};

describe("ChangePasswordForm", () => {
	afterEach(() => vi.restoreAllMocks());

	it("changes the password, refreshes the session and confirms", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
		render(<ChangePasswordForm />);

		submit("oldPass123", "newPass123");

		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("success"));
		expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
			old_password: "oldPass123",
			new_password: "newPass123",
			locale: "en",
		});
		expect(update).toHaveBeenCalled();
	});

	it("reports a wrong current password", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ error: "INVALID_CURRENT_PASSWORD" }), { status: 401 }),
		);
		render(<ChangePasswordForm />);

		submit("wrongPass1", "newPass123");

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("invalidCurrentPassword"),
		);
	});

	it("rejects a new password equal to the current one", async () => {
		render(<ChangePasswordForm />);

		submit("samePass123", "samePass123");

		await waitFor(() => expect(screen.getByText("validation.sameAsCurrent")).toBeInTheDocument());
	});
});
