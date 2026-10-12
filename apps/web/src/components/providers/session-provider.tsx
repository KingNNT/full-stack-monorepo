"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

// Poll at least as often as the server's refresh margin (60s) so idle tabs renew the API
// tokens before they expire and notice a revoked session without waiting for a request
const SESSION_REFETCH_INTERVAL_SECONDS = 60;

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
	return (
		<NextAuthSessionProvider refetchInterval={SESSION_REFETCH_INTERVAL_SECONDS}>
			{children}
		</NextAuthSessionProvider>
	);
};
