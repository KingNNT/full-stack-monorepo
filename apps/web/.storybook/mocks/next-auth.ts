import type React from "react";
import { fn } from "storybook/test";

export const signIn = fn().mockName("signIn").mockResolvedValue({ ok: true, error: null });
export const signOut = fn().mockName("signOut").mockResolvedValue(undefined);
export const useSession = fn().mockName("useSession").mockReturnValue({
	data: null,
	status: "unauthenticated",
});

export const getSession = fn().mockName("getSession").mockResolvedValue(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => children;
