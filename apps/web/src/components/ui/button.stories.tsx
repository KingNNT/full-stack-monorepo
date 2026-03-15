import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChevronRight, Loader2, Mail } from "lucide-react";
import { Button } from "./button";

const meta = {
	title: "UI/Button",
	component: Button,
	args: {
		children: "Button",
	},
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
	args: { variant: "destructive", children: "Delete" },
};

export const Outline: Story = {
	args: { variant: "outline", children: "Outline" },
};

export const Secondary: Story = {
	args: { variant: "secondary", children: "Secondary" },
};

export const Ghost: Story = {
	args: { variant: "ghost", children: "Ghost" },
};

export const LinkVariant: Story = {
	args: { variant: "link", children: "Link" },
};

export const Small: Story = {
	args: { size: "sm", children: "Small" },
};

export const Large: Story = {
	args: { size: "lg", children: "Large" },
};

export const Icon: Story = {
	args: { size: "icon" },
	render: (args) => (
		<Button {...args}>
			<ChevronRight />
		</Button>
	),
};

export const WithIcon: Story = {
	render: (args) => (
		<Button {...args}>
			<Mail /> Login with Email
		</Button>
	),
};

export const Loading: Story = {
	args: { disabled: true },
	render: (args) => (
		<Button {...args}>
			<Loader2 className="animate-spin" /> Please wait
		</Button>
	),
};

export const Disabled: Story = {
	args: { disabled: true },
};

export const AllVariants: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			{(["default", "destructive", "outline", "secondary", "ghost", "link"] as const).map(
				(variant) => (
					<div key={variant} className="flex items-center gap-2">
						<span className="w-24 text-muted-foreground text-sm">{variant}</span>
						{(["sm", "default", "lg"] as const).map((size) => (
							<Button key={size} variant={variant} size={size}>
								{size}
							</Button>
						))}
					</div>
				),
			)}
		</div>
	),
};
