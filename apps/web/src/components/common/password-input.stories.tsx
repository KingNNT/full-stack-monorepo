import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PasswordInput } from "./password-input";

const meta = {
	title: "Common/PasswordInput",
	component: PasswordInput,
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPlaceholder: Story = {
	args: { placeholder: "Enter password" },
};

export const Disabled: Story = {
	args: { placeholder: "Disabled", disabled: true },
};
