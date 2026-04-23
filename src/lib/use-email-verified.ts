import { useEffect, useState } from "react";
import { useSession } from "~/lib/auth-client";

/** Returns whether the user can perform verified-only actions, or null during SSR/hydration. */
export function useEmailVerified(): boolean | null {
	const { data: session } = useSession();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}
	if (!session?.user) {
		return true;
	}
	return session.user.emailVerified;
}
