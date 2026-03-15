"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
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
import { Input } from "@/components/ui/input";
import type { TAuthErrorCode } from "@/constants";
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGE_IDS } from "@/constants";

export const LoginForm = () => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const locale = useLocale();
	const t = useTranslations("pages.login");
	const [error, setError] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);

	// Get callback URL from query params (where user was trying to go)
	const callbackUrl = searchParams.get("callback-url");

	const isAuthErrorCode = (code: unknown): code is TAuthErrorCode =>
		typeof code === "string" && code in AUTH_ERROR_MESSAGE_IDS;

	const loginSchema = z.object({
		email: z.string().email(t("validation.invalidEmail")),
		password: z.string().min(6, t("validation.passwordMinLength")),
	});

	type TLoginFormData = z.infer<typeof loginSchema>;

	const form = useForm<TLoginFormData>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const onSubmit = async (data: TLoginFormData) => {
		setIsLoading(true);
		setError("");

		try {
			const signInResult = await signIn("credentials", {
				email: data.email,
				password: data.password,
				redirect: false,
				callbackUrl: callbackUrl ?? undefined,
			});

			if (!signInResult || signInResult.error) {
				const rawErrorCode = signInResult?.error;
				const errorCode = isAuthErrorCode(rawErrorCode)
					? rawErrorCode
					: AUTH_ERROR_CODES.INVALID_CREDENTIALS;
				const messageId = AUTH_ERROR_MESSAGE_IDS[errorCode];
				const errorKey = messageId.replace("pages.login.", "") || "generalError";
				setError(t(errorKey));
				return;
			}

			const redirectUrl = signInResult.url || callbackUrl || `/${locale}/dashboard`;
			router.push(redirectUrl);
			router.refresh();
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
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("email")}</FormLabel>
									<FormControl>
										<Input
											type="email"
											placeholder={t("emailPlaceholder")}
											disabled={isLoading}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("password")}</FormLabel>
									<FormControl>
										<PasswordInput
											placeholder={t("passwordPlaceholder")}
											disabled={isLoading}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{error && (
							<div className="rounded-md bg-red-50 p-3 text-red-500 text-sm dark:bg-red-950">
								{error}
							</div>
						)}

						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? t("signingIn") : t("signIn")}
						</Button>

						<div className="mt-4 text-center text-muted-foreground text-sm">
							{t("demoCredentials")}
						</div>

						<div className="mt-4 text-center text-muted-foreground text-sm">
							{t("noAccount")}{" "}
							<Link href={`/${locale}/register`} className="text-primary hover:underline">
								{t("registerLink")}
							</Link>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
