import { beforeEach, describe, expect, it, vi } from "vitest";

// Queue-based DB mock, same pattern as bookings.server.test.ts: chained Kysely
// calls return a self-proxy, terminal methods consume from queues. `where` calls
// are recorded so the category filter (the rental false-warning fix) is asserted.

const executeQueue: unknown[] = [];
const whereCalls: unknown[][] = [];

function chainable(): unknown {
	return new Proxy(
		{},
		{
			get(_, prop) {
				if (prop === "execute") {
					return () => executeQueue.shift();
				}
				if (prop === "where") {
					return (...args: unknown[]) => {
						whereCalls.push(args);
						return chainable();
					};
				}
				return () => chainable();
			},
		},
	);
}

vi.mock("~/lib/db/index", () => ({
	db: {
		selectFrom: () => chainable(),
		updateTable: () => chainable(),
	},
}));

vi.mock("~/lib/log", () => ({
	log: { event: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
	withLogContext: (_ctx: unknown, fn: () => unknown) => fn(),
}));

vi.mock("~/lib/log/events", () => ({
	EVENTS: {
		notification: {
			expiry_warning_sent: "notification.expiry_warning_sent",
			expiry_warning_skipped: "notification.expiry_warning_skipped",
		},
	},
}));

vi.mock("kysely", () => {
	const sqlResult = { as: () => sqlResult, $call: () => sqlResult };
	const sqlProxy = new Proxy(() => sqlResult, {
		apply: () => sqlResult,
		get: () => sqlProxy,
	});
	return { sql: sqlProxy };
});

const sendEmail = vi.fn();
vi.mock("@motori/server/email", () => ({
	sendEmail: (args: unknown) => sendEmail(args),
}));

vi.mock("@motori/server/email-wrapper", () => ({
	wrapEmail: (html: string) => html,
}));

import { SITE_URL } from "~/lib/constants";
import { sendListingExpiryWarnings } from "./notifications";

beforeEach(() => {
	executeQueue.length = 0;
	whereCalls.length = 0;
	sendEmail.mockReset();
	sendEmail.mockResolvedValue(undefined);
});

describe("sendListingExpiryWarnings", () => {
	it("sends the warning with a renew link to the dashboard and marks the row notified", async () => {
		executeQueue.push([
			{
				id: "l1",
				title: "Yamaha MT-07",
				expires_at: new Date(Date.now() + 3 * 86_400_000),
				email: "omistaja@example.com",
				display_name: "Testi",
				language: "fi",
			},
		]);
		executeQueue.push([]); // the expiry_notified_at update

		const sent = await sendListingExpiryWarnings();

		expect(sent).toBe(1);
		expect(sendEmail).toHaveBeenCalledTimes(1);
		const args = sendEmail.mock.calls[0][0] as { html: string; text: string };
		expect(args.html).toContain(`${SITE_URL}/omat`);
		expect(args.text).toContain(`${SITE_URL}/omat`);
	});

	it("only warns sale, gear, and part listings — rental never expires", async () => {
		executeQueue.push([]);

		await sendListingExpiryWarnings();

		expect(whereCalls).toContainEqual(["listing.category", "in", ["sale", "gear", "part"]]);
	});
});
