import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoginForm } from "./login-form";

const meta = {
	title: "Auth/LoginForm",
	component: LoginForm,
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCallbackUrl: Story = {
	parameters: {
		nextjs: {
			navigation: {
				pathname: "/en/login",
				query: {},
				searchParams: new URLSearchParams({ "callback-url": "/en/dashboard" }),
			},
		},
	},
};
