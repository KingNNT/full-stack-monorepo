import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(ts|tsx)"],
	addons: ["@storybook/addon-themes"],
	framework: {
		name: "@storybook/nextjs-vite",
		options: {},
	},
	staticDirs: ["../public"],
	viteFinal: async (config) => {
		config.resolve = config.resolve || {};
		config.resolve.alias = {
			...config.resolve.alias,
			"@": resolve(__dirname, "../src"),
			"next-auth/react": resolve(__dirname, "./mocks/next-auth.ts"),
			"@/i18n": resolve(__dirname, "./mocks/i18n.ts"),
			"@/apis": resolve(__dirname, "./mocks/apis.ts"),
		};
		return config;
	},
};

export default config;
