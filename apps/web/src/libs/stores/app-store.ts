import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { LocaleSupport } from "@/enums";

type TTheme = "light" | "dark" | "system";

interface IAppState {
	language: LocaleSupport;
	timezone: string;
	theme: TTheme;
	setLanguage: (language: LocaleSupport) => void;
	setTimezone: (timezone: string) => void;
	setTheme: (theme: TTheme) => void;
	reset: () => void;
}

const initialState = {
	language: LocaleSupport.EN,
	timezone: "UTC",
	theme: "system" as TTheme,
};

export const useAppStore = create<IAppState>()(
	devtools(
		persist(
			(set) => ({
				...initialState,
				setLanguage: (language: LocaleSupport) => set({ language }),
				setTimezone: (timezone: string) => set({ timezone }),
				setTheme: (theme: TTheme) => set({ theme }),
				reset: () => set(initialState),
			}),
			{
				name: "app-store",
			},
		),
	),
);
