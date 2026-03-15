import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
	it("renders as password input by default", () => {
		render(<PasswordInput placeholder="Enter password" />);
		const input = screen.getByPlaceholderText("Enter password");

		expect(input).toHaveAttribute("type", "password");
	});

	it("toggles to text input when visibility button is clicked", async () => {
		const user = userEvent.setup();
		render(<PasswordInput placeholder="Enter password" />);

		const input = screen.getByPlaceholderText("Enter password");
		const toggleButton = screen.getByRole("button");

		expect(input).toHaveAttribute("type", "password");

		await user.click(toggleButton);
		expect(input).toHaveAttribute("type", "text");

		await user.click(toggleButton);
		expect(input).toHaveAttribute("type", "password");
	});

	it("disables both input and toggle button when disabled", () => {
		render(<PasswordInput placeholder="Enter password" disabled />);

		const input = screen.getByPlaceholderText("Enter password");
		const toggleButton = screen.getByRole("button");

		expect(input).toBeDisabled();
		expect(toggleButton).toBeDisabled();
	});

	it("passes additional props to the input element", () => {
		render(<PasswordInput placeholder="Enter password" id="pwd" name="password" />);

		const input = screen.getByPlaceholderText("Enter password");
		expect(input).toHaveAttribute("id", "pwd");
		expect(input).toHaveAttribute("name", "password");
	});
});
