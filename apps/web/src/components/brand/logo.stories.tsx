import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Logo } from "./logo";

const meta = {
	title: "Brand/Logo",
	component: Logo,
	parameters: { layout: "centered" },
	args: { height: 48 },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { height: 24 } };

export const Large: Story = { args: { height: 96 } };

export const Dark: Story = {
	decorators: [
		(Story) => (
			<div className="dark bg-background">
				<Story />
			</div>
		),
	],
};
