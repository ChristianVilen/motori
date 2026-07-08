import { createGetSession } from "@motori/server/session";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "~/lib/auth";

// `auth` and createGetSession are referenced only inside the handler arrow so
// TanStack's compiler prunes them (and their node-only deps) from the client
// bundle. See the note in @motori/server/session.
export const getSession = createServerFn().handler(async () => createGetSession(auth)());
