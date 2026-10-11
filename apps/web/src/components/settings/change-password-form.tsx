"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
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

export const ChangePasswordForm = () => {
	const locale = useLocale();
	const t = useTranslations("pages.settingsSecurity");
	const { update } = useSession();
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const schema = z
		.object({
			currentPassword: z.string().min(1, t("validation.required")),
			newPassword: z
				.string()
				.min(8, t("validation.passwordMinLength"))
				.max(128, t("validation.passwordMaxLength")),
			confirmPassword: z.string(),
		})
		.refine((d) => d.newPassword === d.confirmPassword, {
			message: t("validation.passwordsNotMatch"),
			path: ["confirmPassword"],
		})
		.refine((d) => d.newPassword !== d.currentPassword, {
			message: t("validation.sameAsCurrent"),
			path: ["newPassword"],
		});
	type TFormData = z.infer<typeof schema>;
	const form = useForm<TFormData>({
		resolver: zodResolver(schema),
		defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
	});

	const onSubmit = async (data: TFormData) => {
		setIsLoading(true);
		setError("");
		setSuccess(false);
		try {
			const res = await fetch("/api/v1/users/change-password", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					old_password: data.currentPassword,
					new_password: data.newPassword,
					locale,
				}),
			});
			if (res.ok) {
				// The route handler stored the new tokens in the cookie; reload them client-side
				await update();
				form.reset();
				setSuccess(true);
				return;
			}
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			setError(
				body.error === AUTH_ERROR_CODES.INVALID_CURRENT_PASSWORD
					? t("invalidCurrentPassword")
					: t("generalError"),
			);
		} catch {
			setError(t("generalError"));
		} finally {
			setIsLoading(false);
		}
	};

	const field = (name: keyof TFormData, autoComplete: string) => (
		<FormField
			control={form.control}
			name={name}
			render={({ field: input }) => (
				<FormItem>
					<FormLabel>{t(name)}</FormLabel>
					<FormControl>
						<PasswordInput autoComplete={autoComplete} disabled={isLoading} {...input} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	);

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
				<CardDescription>{t("description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						{field("currentPassword", "current-password")}
						{field("newPassword", "new-password")}
						{field("confirmPassword", "new-password")}

						{error && (
							<div
								role="alert"
								className="rounded-md bg-red-50 p-3 text-red-500 text-sm dark:bg-red-950"
							>
								{error}
							</div>
						)}
						{success && (
							<div role="status" className="rounded-md bg-muted p-3 text-muted-foreground text-sm">
								{t("success")}
							</div>
						)}

						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? t("submitting") : t("submit")}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
