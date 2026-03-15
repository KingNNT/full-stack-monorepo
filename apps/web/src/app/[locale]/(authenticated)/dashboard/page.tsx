import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { ILocalePageProps } from "@/types/page";

export async function generateMetadata({ params }: ILocalePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.dashboard" });

	return {
		title: t("title"),
		description: t("description"),
		alternates: {
			canonical: `/${locale}/dashboard`,
			languages: {
				en: "/en/dashboard",
				vi: "/vi/dashboard",
			},
		},
	};
}

const DashboardPage = () => {
	return <DashboardView />;
};

export default DashboardPage;
