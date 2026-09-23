import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCronTasks } from "./cron";

const log = { error: vi.fn() };

// The rate-limit buckets are module state, so each request gets its own IP
// unless a test pins one.
let nextIp = 0;

function request(token?: string, task?: string, ip: string | null = `10.0.0.${++nextIp}`): Request {
	const url = task ? `https://app.test/api/cron?task=${task}` : "https://app.test/api/cron";
	const headers: Record<string, string> = {};
	if (token) {
		headers.authorization = `Bearer ${token}`;
	}
	if (ip) {
		headers["x-forwarded-for"] = ip;
	}
	return new Request(url, { method: "POST", headers });
}

beforeEach(() => {
	process.env.CRON_SECRET = "s3cret";
	vi.clearAllMocks();
});

afterEach(() => {
	delete process.env.CRON_SECRET;
});

describe("runCronTasks", () => {
	it("returns 500 when CRON_SECRET is not configured", async () => {
		delete process.env.CRON_SECRET;
		const res = await runCronTasks(request("s3cret"), {}, log);
		expect(res.status).toBe(500);
	});

	it("returns 401 without an authorization header", async () => {
		const res = await runCronTasks(request(), {}, log);
		expect(res.status).toBe(401);
	});

	it("returns 401 for a wrong token", async () => {
		const res = await runCronTasks(request("wrong!"), {}, log);
		expect(res.status).toBe(401);
	});

	it("returns 401 for a token of different length", async () => {
		const res = await runCronTasks(request("s3cret-but-longer"), {}, log);
		expect(res.status).toBe(401);
	});

	it("runs all tasks when no task param is given", async () => {
		const tasks = {
			a: vi.fn(async () => ({ ok: 1 })),
			b: vi.fn(async () => ({ ok: 2 })),
		};
		const res = await runCronTasks(request("s3cret"), tasks, log);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ a: { ok: 1 }, b: { ok: 2 } });
		expect(tasks.a).toHaveBeenCalledOnce();
		expect(tasks.b).toHaveBeenCalledOnce();
	});

	it("runs only the named task", async () => {
		const tasks = {
			a: vi.fn(async () => ({ ok: 1 })),
			b: vi.fn(async () => ({ ok: 2 })),
		};
		const res = await runCronTasks(request("s3cret", "b"), tasks, log);
		expect(await res.json()).toEqual({ b: { ok: 2 } });
		expect(tasks.a).not.toHaveBeenCalled();
	});

	it("returns 400 for an unknown task", async () => {
		const res = await runCronTasks(request("s3cret", "nope"), { a: async () => ({}) }, log);
		expect(res.status).toBe(400);
		expect(await res.text()).toBe("Unknown task: nope");
	});

	it("reports a failing task without aborting the rest", async () => {
		const tasks = {
			boom: async () => {
				throw new Error("kaboom");
			},
			ok: async () => ({ done: true }),
		};
		const res = await runCronTasks(request("s3cret"), tasks, log);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ boom: { error: "kaboom" }, ok: { done: true } });
		expect(log.error).toHaveBeenCalledWith("cron: task boom failed", {
			err: expect.any(Error),
		});
	});

	it("reports a non-Error throw as a string", async () => {
		const tasks = {
			boom: async () => {
				throw "kaboom-string";
			},
		};
		const res = await runCronTasks(request("s3cret"), tasks, log);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ boom: { error: "kaboom-string" } });
	});

	it("returns 429 after 10 requests from one IP, even with the right token", async () => {
		for (let i = 0; i < 10; i++) {
			await runCronTasks(request("wrong!", undefined, "203.0.113.1"), {}, log);
		}
		const task = vi.fn(async () => ({}));
		const res = await runCronTasks(request("s3cret", undefined, "203.0.113.1"), { task }, log);
		expect(res.status).toBe(429);
		expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
		expect(task).not.toHaveBeenCalled();
	});

	it("keeps the limit per IP", async () => {
		for (let i = 0; i < 10; i++) {
			await runCronTasks(request("wrong!", undefined, "203.0.113.2"), {}, log);
		}
		const res = await runCronTasks(request("s3cret", undefined, "203.0.113.3"), {}, log);
		expect(res.status).toBe(200);
	});

	it("limits requests that carry no client IP", async () => {
		for (let i = 0; i < 10; i++) {
			await runCronTasks(request("wrong!", undefined, null), {}, log);
		}
		const res = await runCronTasks(request("s3cret", undefined, null), {}, log);
		expect(res.status).toBe(429);
	});
});
