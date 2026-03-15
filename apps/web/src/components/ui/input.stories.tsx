import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
	title: "UI/Input",
	component: Input,
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPlaceholder: Story = {
	args: { placeholder: "Enter your email..." },
};

export const Email: Story = {
	args: { type: "email", placeholder: "user@example.com" },
};

export const Password: Story = {
	args: { type: "password", placeholder: "••••••••" },
};

export const Disabled: Story = {
	args: { disabled: true, placeholder: "Disabled input", value: "Cannot edit" },
};

export const Invalid: Story = {
	args: { "aria-invalid": true, value: "invalid value" },
};

export const WithLabel: Story = {
	render: (args) => (
		<div className="grid w-full max-w-sm gap-1.5">
			<Label htmlFor="email">Email</Label>
			<Input {...args} id="email" type="email" placeholder="user@example.com" />
		</div>
	),
};
