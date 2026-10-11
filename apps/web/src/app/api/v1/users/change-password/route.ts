import { toLocale } from "@/i18n/config";
import { authService } from "@/services/auth.service";
import { auth, unstable_update } from "@/services/next-auth";
import { _200, _401, createApiRoute } from "@/utils/api-routes";

export const POST = createApiRoute(async (request) => {
	const session = await auth();
	if (!session?.accessToken) {
		return _401();
	}

	const { old_password, new_password, locale } = await request.json();
	const tokens = await authService.changePassword(
		session.accessToken,
		String(old_password ?? ""),
		String(new_password ?? ""),
		toLocale(locale),
	);

	// Keep this browser signed in: the API revoked every token issued before
	await unstable_update({ apiTokens: tokens });
	return _200({}, "Password changed");
});
