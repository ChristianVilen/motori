import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { __setRootLoggerForTest } from "./context";
import { EVENTS } from "./events";
import { log } from "./index";
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

describe("log.event", () => {
	it("emits info with event name as msg and an `event` field", () => {
		const { stream, lines } = memoryStream();
		__setRootLoggerForTest(
			createRootLogger({ isProd: false, pretty: false, level: "trace" }, stream),
		);

		log.event(EVENTS.listing.created, { listingId: "L1" });

		const entry = JSON.parse(lines[0]);
		expect(entry.level).toBe(30); // pino 'info'
		expect(entry.msg).toBe("listing.created");
		expect(entry.event).toBe("listing.created");
		expect(entry.listingId).toBe("L1");
	});

	it("log.info accepts msg-only and msg+fields", () => {
		const { stream, lines } = memoryStream();
		__setRootLoggerForTest(
			createRootLogger({ isProd: false, pretty: false, level: "trace" }, stream),
		);

		log.info("plain");
		log.info("with fields", { foo: "bar" });

		expect(JSON.parse(lines[0]).msg).toBe("plain");
		const second = JSON.parse(lines[1]);
		expect(second.msg).toBe("with fields");
		expect(second.foo).toBe("bar");
	});
});
