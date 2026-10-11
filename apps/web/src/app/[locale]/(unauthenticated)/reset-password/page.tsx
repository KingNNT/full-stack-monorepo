import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import type { ILocalePageProps } from "@/types/page";

export async function generateMetadata({ params }: ILocalePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.resetPassword" });

	return {
		title: t("title"),
		description: t("description"),
		// The URL carries a secret token: keep it out of Referer headers and indexes
		referrer: "no-referrer",
		robots: { index: false, follow: false },
	};
}

interface IResetPasswordPageProps extends ILocalePageProps {
	searchParams: Promise<{ token?: string }>;
}

const ResetPasswordPage = async ({ searchParams }: IResetPasswordPageProps) => {
	const { token } = await searchParams;
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<ResetPasswordForm token={token ?? null} />
		</div>
	);
};

export default ResetPasswordPage;
