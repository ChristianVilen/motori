import { useEffect, useState } from "react";
import { useSession } from "~/lib/auth-client";

/** Returns true if the user can perform verified-only actions (create listing, message, etc.). */
export function useEmailVerified(): boolean {
	const { data: session } = useSession();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Before mount, return true to match SSR output (no session available on server)
	if (!mounted || !session?.user) {
		return true;
	}
	return session.user.emailVerified;
}
