"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { authApi, HttpStatusError } from "@/apis";
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

export const RegisterForm = () => {
	const router = useRouter();
	const locale = useLocale();
	const t = useTranslations("pages.register");
	const [error, setError] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);

	const registerSchema = z
		.object({
			name: z.string().min(1, t("validation.nameRequired")).min(2, t("validation.nameMinLength")),
			email: z.string().email(t("validation.invalidEmail")),
			password: z.string().min(6, t("validation.passwordMinLength")),
			confirmPassword: z.string(),
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: t("validation.passwordsNotMatch"),
			path: ["confirmPassword"],
		});

	type TRegisterFormData = z.infer<typeof registerSchema>;

	const form = useForm<TRegisterFormData>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
	});

	const onSubmit = async (data: TRegisterFormData) => {
		setIsLoading(true);
		setError("");

		try {
			// Call the registration API using authApi
			await authApi.register({
				name: data.name,
				email: data.email,
				password: data.password,
			});

			// Registration successful - redirect to login
			router.push(`/${locale}/login`);
		} catch (error) {
			// Handle specific error cases
			if (error instanceof HttpStatusError) {
				if (error.statusCode === 409) {
					setError(t("emailExists"));
				} else {
					setError(t("generalError"));
				}
			} else {
				setError(t("generalError"));
			}
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
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("name")}</FormLabel>
									<FormControl>
										<Input
											type="text"
											autoComplete="name"
											placeholder={t("namePlaceholder")}
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
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("email")}</FormLabel>
									<FormControl>
										<Input
											type="email"
											autoComplete="email"
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
											autoComplete="new-password"
											placeholder={t("passwordPlaceholder")}
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
							name="confirmPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("confirmPassword")}</FormLabel>
									<FormControl>
										<PasswordInput
											autoComplete="new-password"
											placeholder={t("confirmPasswordPlaceholder")}
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
							{isLoading ? t("signingUp") : t("signUp")}
						</Button>

						<div className="mt-4 text-center text-muted-foreground text-sm">
							{t("haveAccount")}{" "}
							<Link href={`/${locale}/login`} className="text-primary hover:underline">
								{t("loginLink")}
							</Link>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
