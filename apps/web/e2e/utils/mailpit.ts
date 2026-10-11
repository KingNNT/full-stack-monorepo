import type { APIRequestContext } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

/** Polls Mailpit for the newest message to `email` and returns its reset token. */
export async function waitForResetToken(
	request: APIRequestContext,
	email: string,
): Promise<string> {
	for (let attempt = 0; attempt < 20; attempt++) {
		const list = await request.get(`${MAILPIT_URL}/api/v1/search`, {
			params: { query: `to:${email} subject:"Reset your password"` },
		});
		const { messages } = (await list.json()) as { messages: Array<{ ID: string }> };
		if (messages.length > 0) {
			const message = await request.get(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`);
			const { Text } = (await message.json()) as { Text: string };
			const match = /reset-password\?token=([^\s&]+)/.exec(Text);
			if (match) return decodeURIComponent(match[1]);
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error(`No reset email for ${email}`);
}
