"use client";

import { useTranslations } from "next-intl";

export const DashboardView = () => {
	const t = useTranslations("pages.dashboard");

	return (
		<div>
			<h1 className="mb-6 font-bold text-3xl">{t("welcome")}</h1>
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{/* Dashboard content will go here */}
			</div>
		</div>
	);
};
