"use client";

import { LogOut, Menu } from "lucide-react";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ModeToggle } from "@/components/theme/mode-toggler";
import { Button } from "@/components/ui/button";

interface IPrivateHeaderProps {
	onMenuClick?: () => void;
}

export const PrivateHeader = ({ onMenuClick }: IPrivateHeaderProps) => {
	const locale = useLocale();
	const tNav = useTranslations("navigation");
	const tAuth = useTranslations("auth");

	const handleSignOut = async () => {
		await signOut({ callbackUrl: `/${locale}/login` });
	};

	return (
		<header className="sticky top-0 z-10 border-b bg-card py-4">
			<div className="container mx-auto flex items-center justify-between px-4">
				<div className="flex items-center space-x-4">
					<Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
						<Menu className="h-5 w-5" />
					</Button>
					<h1 className="font-semibold text-2xl">{tNav("title")}</h1>
				</div>
				<nav className="flex items-center space-x-2">
					<LocaleSwitcher />
					<ModeToggle />
					<Button
						variant="ghost"
						size="sm"
						onClick={handleSignOut}
						className="flex items-center space-x-2"
					>
						<LogOut className="h-4 w-4" />
						<span className="hidden sm:inline">{tAuth("signOut")}</span>
					</Button>
				</nav>
			</div>
		</header>
	);
};
