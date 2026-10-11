import { toLocale } from "@/i18n/config";
import { authService } from "@/services/auth.service";
import { _200, createApiRoute } from "@/utils/api-routes";

export const POST = createApiRoute(async (request) => {
	const { token, password, locale } = await request.json();
	await authService.resetPassword(String(token ?? ""), String(password ?? ""), toLocale(locale));
	return _200({}, "Password has been reset");
});
