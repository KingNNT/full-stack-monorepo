"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { authApi } from "@/apis";
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
import { Input } from "@/components/ui/input";
import type { TLocale } from "@/i18n/config";

const RESEND_COOLDOWN_S = 60;

export const ForgotPasswordForm = () => {
	const locale = useLocale() as TLocale;
	const t = useTranslations("pages.forgotPassword");
	const [sent, setSent] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [cooldown, setCooldown] = useState(0);

	useEffect(() => {
		if (cooldown <= 0) return;
		const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
		return () => clearTimeout(timer);
	}, [cooldown]);

	const schema = z.object({ email: z.string().email(t("validation.invalidEmail")) });
	type TFormData = z.infer<typeof schema>;
	const form = useForm<TFormData>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

	const onSubmit = async (data: TFormData) => {
		setIsLoading(true);
		try {
			await authApi.forgotPassword({ email: data.email, locale });
		} catch {
			// Same message either way: never reveal whether the account exists
		} finally {
			setSent(true);
			setCooldown(RESEND_COOLDOWN_S);
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
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("email")}</FormLabel>
									<FormControl>
										<Input type="email" autoComplete="email" disabled={isLoading} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{sent && (
							<div role="status" className="rounded-md bg-muted p-3 text-muted-foreground text-sm">
								{t("sent")}
							</div>
						)}

						<Button type="submit" className="w-full" disabled={isLoading || cooldown > 0}>
							{cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("submit")}
						</Button>

						<div className="text-center text-muted-foreground text-sm">
							<Link href={`/${locale}/login`} className="text-primary hover:underline">
								{t("backToLogin")}
							</Link>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
