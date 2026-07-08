import { getRequest } from "@tanstack/react-start/server";
import type { Auth } from "./auth";

// Returns a plain resolver, NOT a createServerFn — deliberately. The app must
// wrap this in its own createServerFn().handler() so `auth` is referenced only
// inside the handler arrow. That lets TanStack's compiler prune the auth import
// (and its node-only transitive deps, e.g. AsyncLocalStorage) from the client
// bundle. A factory that owned the createServerFn would keep the eager `auth`
// singleton live at the app module top level and leak it into the client trace.
export function createGetSession(auth: Auth) {
	return async () => {
		const request = getRequest();
		return auth.api.getSession({ headers: request.headers });
	};
}
