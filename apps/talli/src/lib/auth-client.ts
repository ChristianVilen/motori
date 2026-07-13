import { createAuthClient } from "better-auth/react";
import { MOTORI_URL } from "~/lib/constants";

// talli mounts no auth routes — sign-out (the only client auth call) goes
// cross-origin to motori. Requires motori's CORS to allow talli's origin (Task 4).
export const authClient = createAuthClient({
	baseURL: MOTORI_URL,
});

export const { signOut } = authClient;
