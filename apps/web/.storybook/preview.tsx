import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../src/langs/en.json";
import viMessages from "../src/langs/vi.json";
import "../src/app/globals.css";

const messages: Record<string, typeof enMessages> = {
	en: enMessages,
	vi: viMessages,
};

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /date$/i,
			},
		},
		layout: "centered",
		nextjs: {
			appDirectory: true,
			navigation: {
				pathname: "/en/home",
				query: {},
			},
		},
	},
	globalTypes: {
		locale: {
			description: "Internationalization locale",
			toolbar: {
				title: "Locale",
				icon: "globe",
				items: [
					{ value: "en", title: "English", right: "EN" },
					{ value: "vi", title: "Tiếng Việt", right: "VI" },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: {
		locale: "en",
	},
	decorators: [
		withThemeByClassName({
			themes: {
				light: "",
				dark: "dark",
			},
			defaultTheme: "light",
		}),
		(Story, context) => {
			const locale = (context.globals.locale as string) || "en";
			return (
				<NextIntlClientProvider locale={locale} messages={messages[locale] || enMessages}>
					<Story />
				</NextIntlClientProvider>
			);
		},
	],
};

export default preview;
