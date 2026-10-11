import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import type { ILocalePageProps } from "@/types/page";

export async function generateMetadata({ params }: ILocalePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.forgotPassword" });

	return {
		title: t("title"),
		description: t("description"),
		alternates: {
			canonical: `/${locale}/forgot-password`,
			languages: { en: "/en/forgot-password", vi: "/vi/forgot-password" },
		},
	};
}

const ForgotPasswordPage = () => (
	<div className="flex min-h-screen items-center justify-center p-4">
		<ForgotPasswordForm />
	</div>
);

export default ForgotPasswordPage;
