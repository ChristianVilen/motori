import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCronTasks } from "./cron";

const log = { error: vi.fn() };

function request(token?: string, task?: string): Request {
	const url = task ? `https://app.test/api/cron?task=${task}` : "https://app.test/api/cron";
	return new Request(url, {
		method: "POST",
		headers: token ? { authorization: `Bearer ${token}` } : undefined,
	});
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
});
