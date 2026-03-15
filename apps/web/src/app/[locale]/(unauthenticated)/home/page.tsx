import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HomeView } from "@/components/home/home-view";
import type { ILocalePageProps } from "@/types/page";

export async function generateMetadata({ params }: ILocalePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.home" });

	return {
		title: t("title"),
		description: t("description"),
		alternates: {
			canonical: `/${locale}/home`,
			languages: {
				en: "/en/home",
				vi: "/vi/home",
			},
		},
	};
}

const HomePage = () => {
	return <HomeView />;
};

export default HomePage;
