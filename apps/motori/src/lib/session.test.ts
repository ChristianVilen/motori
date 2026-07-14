import { beforeEach, describe, expect, it, vi } from "vitest";

let mockSession: unknown = null;

// Reduce createServerFn to the bare handler so getSession() runs directly.
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({ handler: (fn: () => unknown) => fn }),
}));

vi.mock("~/lib/auth", () => ({ auth: {} }));

vi.mock("@motori/server/session", () => ({
	createGetSession: () => () => mockSession,
}));

import { isRedirect } from "@tanstack/react-router";
import { requireSession, requireSessionOrRedirect, requireUserId } from "./session";

const session = { user: { id: "user-1", email: "user@test.fi" } };

beforeEach(() => {
	mockSession = null;
});

describe("requireSession", () => {
	it("throws auth.unauthorized when signed out", async () => {
		await expect(requireSession()).rejects.toThrow("auth.unauthorized");
	});

	it("returns the session when signed in", async () => {
		mockSession = session;
		await expect(requireSession()).resolves.toBe(session);
	});
});

describe("requireUserId", () => {
	it("throws auth.unauthorized when signed out", async () => {
		await expect(requireUserId()).rejects.toThrow("auth.unauthorized");
	});

	it("returns the user id when signed in", async () => {
		mockSession = session;
		await expect(requireUserId()).resolves.toBe("user-1");
	});
});

describe("requireSessionOrRedirect", () => {
	it("redirects anonymous visitors to /kirjaudu with the return path", async () => {
		try {
			await requireSessionOrRedirect("/omat/varaukset");
			expect.unreachable("should have thrown a redirect");
		} catch (err) {
			expect(isRedirect(err)).toBe(true);
			// biome-ignore lint/suspicious/noExplicitAny: redirect internals differ per router version
			const target = (err as any).options ?? err;
			expect(target.to).toBe("/kirjaudu");
			expect(target.search).toEqual({ redirect: "/omat/varaukset" });
		}
	});

	it("returns the session when signed in", async () => {
		mockSession = session;
		await expect(requireSessionOrRedirect()).resolves.toBe(session);
	});
});
