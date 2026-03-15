import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth/register-form";
import type { ILocalePageProps } from "@/types/page";

export async function generateMetadata({ params }: ILocalePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.register" });

	return {
		title: t("title"),
		description: t("description"),
		alternates: {
			canonical: `/${locale}/register`,
			languages: {
				en: "/en/register",
				vi: "/vi/register",
			},
		},
	};
}

const RegisterPage = () => {
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<RegisterForm />
		</div>
	);
};

export default RegisterPage;
