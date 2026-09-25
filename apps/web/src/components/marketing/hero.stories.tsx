import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Hero } from "./hero";

const meta = {
	title: "Marketing/Hero",
	component: Hero,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Hero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = {
	decorators: [
		(Story) => (
			<div className="dark bg-background">
				<Story />
			</div>
		),
	],
};
