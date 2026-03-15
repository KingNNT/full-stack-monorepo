import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import type { ILocalePageProps } from "@/types/page";

export async function generateMetadata({ params }: ILocalePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.login" });

	return {
		title: t("title"),
		description: t("description"),
		alternates: {
			canonical: `/${locale}/login`,
			languages: {
				en: "/en/login",
				vi: "/vi/login",
			},
		},
	};
}

const LoginPage = () => {
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<LoginForm />
		</div>
	);
};

export default LoginPage;
