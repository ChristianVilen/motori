import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createRootLogger } from "./pino";

function memoryStream() {
	const lines: string[] = [];
	const stream = new Writable({
		write(chunk, _enc, cb) {
			lines.push(chunk.toString());
			cb();
		},
	});
	return { stream, lines };
}

function parseLastLine(lines: string[]): Record<string, unknown> {
	const last = lines.at(-1);
	if (!last) {
		throw new Error("no log line emitted");
	}
	return JSON.parse(last);
}

describe("pino factory (production redaction)", () => {
	it("redacts configured PII paths and keeps others", () => {
		const { stream, lines } = memoryStream();
		const logger = createRootLogger({ isProd: true, level: "trace" }, stream);

		logger.info(
			{
				userId: "u_1",
				user: { email: "a@b.fi", password: "secret" },
				req: { headers: { authorization: "Bearer x", cookie: "s=1" } },
				listingId: "L1",
			},
			"hello",
		);

		const entry = parseLastLine(lines);
		expect(entry.msg).toBe("hello");
		expect(entry.userId).toBe("u_1");
		expect(entry.listingId).toBe("L1");
		expect((entry.user as Record<string, unknown>).email).toBe("[REDACTED]");
		expect((entry.user as Record<string, unknown>).password).toBe("[REDACTED]");
		const reqHeaders = (entry.req as Record<string, unknown>).headers as Record<string, unknown>;
		expect(reqHeaders.authorization).toBe("[REDACTED]");
		expect(reqHeaders.cookie).toBe("[REDACTED]");
	});

	it("does not redact in non-prod", () => {
		const { stream, lines } = memoryStream();
		const logger = createRootLogger({ isProd: false, level: "trace", pretty: false }, stream);

		logger.info({ user: { email: "a@b.fi" } }, "hello");

		const entry = parseLastLine(lines);
		expect((entry.user as Record<string, unknown>).email).toBe("a@b.fi");
	});
});
