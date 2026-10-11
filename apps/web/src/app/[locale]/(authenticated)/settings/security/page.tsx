import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import type { ILocalePageProps } from "@/types/page";

export async function generateMetadata({ params }: ILocalePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.settingsSecurity" });
	return { title: t("title"), robots: { index: false, follow: false } };
}

const SecuritySettingsPage = () => (
	<div className="p-4 md:p-8">
		<ChangePasswordForm />
	</div>
);

export default SecuritySettingsPage;
