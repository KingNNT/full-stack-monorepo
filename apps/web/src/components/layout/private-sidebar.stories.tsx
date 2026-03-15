import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { PrivateSidebar } from "./private-sidebar";

const meta = {
	title: "Layout/PrivateSidebar",
	component: PrivateSidebar,
	parameters: { layout: "fullscreen" },
	args: {
		onClose: fn(),
	},
} satisfies Meta<typeof PrivateSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
	args: { isOpen: true },
};

export const Closed: Story = {
	args: { isOpen: false },
};

export const DashboardActive: Story = {
	args: { isOpen: true },
	parameters: {
		nextjs: {
			navigation: { pathname: "/en/dashboard" },
		},
	},
};
