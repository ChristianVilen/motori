import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { __setRootLoggerForTest, getLogger, withLogContext } from "./context";
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

describe("log context", () => {
	it("merges bindings from withLogContext into emitted lines", async () => {
		const { stream, lines } = memoryStream();
		__setRootLoggerForTest(
			createRootLogger({ isProd: false, pretty: false, level: "trace" }, stream),
		);

		await withLogContext({ requestId: "r1", userId: "u1" }, async () => {
			getLogger().info({ event: "x" }, "inside");
		});
		getLogger().info({ event: "y" }, "outside");

		const inside = JSON.parse(lines[0]);
		const outside = JSON.parse(lines[1]);

		expect(inside.requestId).toBe("r1");
		expect(inside.userId).toBe("u1");
		expect(inside.msg).toBe("inside");

		expect(outside.requestId).toBeUndefined();
		expect(outside.userId).toBeUndefined();
		expect(outside.msg).toBe("outside");
	});

	it("nested withLogContext composes bindings", async () => {
		const { stream, lines } = memoryStream();
		__setRootLoggerForTest(
			createRootLogger({ isProd: false, pretty: false, level: "trace" }, stream),
		);

		await withLogContext({ requestId: "r1" }, async () => {
			await withLogContext({ userId: "u1" }, async () => {
				getLogger().info("nested");
			});
		});

		const line = JSON.parse(lines[0]);
		expect(line.requestId).toBe("r1");
		expect(line.userId).toBe("u1");
	});
});
