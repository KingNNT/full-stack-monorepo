"use client";

import { useTranslations } from "next-intl";

export const HomeView = () => {
	const t = useTranslations("common");

	return (
		<main className="container mx-auto flex-grow py-16">
			<div className="text-center">
				<h1 className="font-bold text-4xl">{t("welcome")}</h1>
			</div>
		</main>
	);
};
