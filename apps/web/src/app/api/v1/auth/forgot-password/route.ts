import { toLocale } from "@/i18n/config";
import { authService } from "@/services/auth.service";
import { _200, createApiRoute } from "@/utils/api-routes";

export const POST = createApiRoute(async (request) => {
	const { email, locale } = await request.json();
	await authService.forgotPassword(String(email ?? ""), toLocale(locale));
	// Same answer whether or not the account exists
	return _200({}, "If the email is registered, a reset link has been sent");
});
