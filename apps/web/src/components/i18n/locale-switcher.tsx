"use client";

import { Globe } from "lucide-react";
import { useLocale } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type TLocale, usePathname, useRouter } from "@/i18n";

export const LocaleSwitcher = () => {
	const locale = useLocale();
	const router = useRouter();
	const pathname = usePathname();
	const [isPending, startTransition] = useTransition();

	const switchLocale = (newLocale: TLocale) => {
		// Set cookie for future visits
		// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not widely supported, direct assignment is standard for locale preference
		document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=lax`;

		// Navigate to new locale using next-intl router
		startTransition(() => {
			router.replace(pathname, { locale: newLocale });
		});
	};

	const localeNames: Record<TLocale, string> = {
		en: "English",
		vi: "Tiếng Việt",
	};

	const localeFlags: Record<TLocale, string> = {
		en: "🇺🇸",
		vi: "🇻🇳",
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="gap-2" disabled={isPending}>
					<Globe className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
					<span className="hidden sm:inline">{localeNames[locale as TLocale]}</span>
					<span className="sm:hidden">{localeFlags[locale as TLocale]}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{locales.map((loc) => (
					<DropdownMenuItem
						key={loc}
						onClick={() => switchLocale(loc)}
						className={locale === loc ? "bg-accent" : ""}
					>
						<span className="mr-2">{localeFlags[loc]}</span>
						{localeNames[loc]}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
