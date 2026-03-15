import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import React from "react";
import { PrivateLayoutWrapper } from "./private-layout-wrapper";

const meta = {
	title: "Layout/PrivateLayoutWrapper",
	component: PrivateLayoutWrapper,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PrivateLayoutWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		children: React.createElement(
			"div",
			{ className: "p-8" },
			React.createElement("h1", { className: "font-bold text-3xl" }, "Page Content"),
			React.createElement(
				"p",
				{ className: "mt-4 text-muted-foreground" },
				"This is a placeholder for the main content area.",
			),
		),
	},
};
