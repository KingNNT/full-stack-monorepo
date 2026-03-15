import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ThemeProvider } from "next-themes";
import { ModeToggle } from "./mode-toggler";

const meta = {
	title: "Theme/ModeToggle",
	component: ModeToggle,
	decorators: [
		(Story) => (
			<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
				<Story />
			</ThemeProvider>
		),
	],
} satisfies Meta<typeof ModeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
