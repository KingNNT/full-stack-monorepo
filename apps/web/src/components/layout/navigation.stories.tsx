import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useSession } from "next-auth/react";
import type { fn } from "storybook/test";
import { Navigation } from "./navigation";

const meta = {
	title: "Layout/Navigation",
	component: Navigation,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Navigation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unauthenticated: Story = {};

export const Authenticated: Story = {
	beforeEach: () => {
		(useSession as ReturnType<typeof fn>).mockReturnValue({
			data: { user: { name: "Demo User", email: "demo@example.com" }, expires: "" },
			status: "authenticated",
		});
	},
};
