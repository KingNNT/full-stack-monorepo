import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardView } from "./dashboard-view";

const meta = {
	title: "Dashboard/DashboardView",
	component: DashboardView,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DashboardView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
