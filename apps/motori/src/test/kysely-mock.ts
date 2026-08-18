// Queue-based Kysely mock shared by the DB-layer unit tests.
// Chained calls return a self-proxy; terminal methods consume from queues.
// Tests push expected results onto the queues IN THE ORDER the production
// code executes its queries. `where` and `values` arguments are recorded so
// filters and inserts can be asserted.
//
// Usage:
//   vi.mock("~/lib/db/index", async () => (await import("~/test/kysely-mock")).dbModuleMock());
//   vi.mock("kysely", async () => (await import("~/test/kysely-mock")).kyselyModuleMock());
//   beforeEach(resetDbMock);

export const executeQueue: unknown[] = [];
export const executeTakeFirstQueue: unknown[] = [];
export const executeTakeFirstOrThrowQueue: unknown[] = [];
export const whereCalls: unknown[][] = [];
export const valuesCalls: unknown[] = [];

export function chainable(): unknown {
	return new Proxy(
		{},
		{
			get(_, prop) {
				if (prop === "execute") {
					return () => executeQueue.shift();
				}
				if (prop === "executeTakeFirst") {
					return () => executeTakeFirstQueue.shift();
				}
				if (prop === "executeTakeFirstOrThrow") {
					return () => executeTakeFirstOrThrowQueue.shift();
				}
				if (prop === "where") {
					return (...args: unknown[]) => {
						whereCalls.push(args);
						return chainable();
					};
				}
				if (prop === "values") {
					return (v: unknown) => {
						valuesCalls.push(v);
						return chainable();
					};
				}
				return () => chainable();
			},
		},
	);
}

export function resetDbMock(): void {
	executeQueue.length = 0;
	executeTakeFirstQueue.length = 0;
	executeTakeFirstOrThrowQueue.length = 0;
	whereCalls.length = 0;
	valuesCalls.length = 0;
}

/** Factory for vi.mock("~/lib/db/index"). Transactions run the callback with the same mock. */
export function dbModuleMock() {
	const tables = {
		selectFrom: () => chainable(),
		insertInto: () => chainable(),
		updateTable: () => chainable(),
		deleteFrom: () => chainable(),
	};
	return {
		db: {
			...tables,
			transaction: () => ({ execute: (fn: (trx: unknown) => unknown) => fn(tables) }),
		},
	};
}

/** Factory for vi.mock("kysely"): a `sql` tag whose result absorbs any chained call. */
export function kyselyModuleMock() {
	const sqlResult = { as: (): unknown => sqlResult, $call: (): unknown => sqlResult };
	const sqlProxy: unknown = new Proxy(() => sqlResult, {
		apply: () => sqlResult,
		get: () => sqlProxy,
	});
	return { sql: sqlProxy };
}
