import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { PrivateHeader } from "./private-header";

const meta = {
	title: "Layout/PrivateHeader",
	component: PrivateHeader,
	parameters: { layout: "fullscreen" },
	args: {
		onMenuClick: fn(),
	},
} satisfies Meta<typeof PrivateHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
