"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { PasswordInput } from "@/components/common/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { AUTH_ERROR_CODES } from "@/constants";

interface IResetPasswordFormProps {
	token: string | null;
}

export const ResetPasswordForm = ({ token }: IResetPasswordFormProps) => {
	const router = useRouter();
	const locale = useLocale();
	const t = useTranslations("pages.resetPassword");
	const [error, setError] = useState(token ? "" : t("invalidToken"));
	const [isLoading, setIsLoading] = useState(false);

	const schema = z
		.object({
			password: z
				.string()
				.min(8, t("validation.passwordMinLength"))
				.max(128, t("validation.passwordMaxLength")),
			confirmPassword: z.string(),
		})
		.refine((d) => d.password === d.confirmPassword, {
			message: t("validation.passwordsNotMatch"),
			path: ["confirmPassword"],
		});
	type TFormData = z.infer<typeof schema>;
	const form = useForm<TFormData>({
		resolver: zodResolver(schema),
		defaultValues: { password: "", confirmPassword: "" },
	});

	const onSubmit = async (data: TFormData) => {
		if (!token) return;
		setIsLoading(true);
		setError("");
		try {
			// Posts to the web route handler (not authApi.resetPassword, which sends the
			// API's `new_password`); the handler's body uses `password`
			const res = await fetch("/api/v1/auth/reset-password", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ token, password: data.password, locale }),
			});
			if (res.ok) {
				router.push(`/${locale}/login?reason=password_reset`);
				return;
			}
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			setError(
				body.error === AUTH_ERROR_CODES.INVALID_RESET_TOKEN ? t("invalidToken") : t("generalError"),
			);
		} catch {
			setError(t("generalError"));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
				<CardDescription>{t("description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("password")}</FormLabel>
									<FormControl>
										<PasswordInput
											autoComplete="new-password"
											disabled={isLoading || !token}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="confirmPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("confirmPassword")}</FormLabel>
									<FormControl>
										<PasswordInput
											autoComplete="new-password"
											disabled={isLoading || !token}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{error && (
							<div
								role="alert"
								className="rounded-md bg-red-50 p-3 text-red-500 text-sm dark:bg-red-950"
							>
								{error}{" "}
								<Link href={`/${locale}/forgot-password`} className="underline">
									{t("requestNew")}
								</Link>
							</div>
						)}

						<Button type="submit" className="w-full" disabled={isLoading || !token}>
							{isLoading ? t("submitting") : t("submit")}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
