import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HomeView } from "./home-view";

const meta = {
	title: "Home/HomeView",
	component: HomeView,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HomeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
