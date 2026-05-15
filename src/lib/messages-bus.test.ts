import { describe, expect, it, vi } from "vitest";
import type { Message } from "~/lib/db/schema";
import { publish, subscribe } from "./messages-bus";

describe("messages-bus", () => {
	it("delivers published messages to subscribers of that conversation", () => {
		const onMessage = vi.fn();
		const unsub = subscribe("conv-1", onMessage);
		publish("conv-1", { id: "m1" } as unknown as Message);
		expect(onMessage).toHaveBeenCalledWith({ id: "m1" });
		unsub();
	});

	it("does not deliver to subscribers of other conversations", () => {
		const onMessage = vi.fn();
		const unsub = subscribe("conv-1", onMessage);
		publish("conv-2", { id: "m1" } as unknown as Message);
		expect(onMessage).not.toHaveBeenCalled();
		unsub();
	});

	it("stops delivering after unsubscribe", () => {
		const onMessage = vi.fn();
		const unsub = subscribe("conv-1", onMessage);
		unsub();
		publish("conv-1", { id: "m1" } as unknown as Message);
		expect(onMessage).not.toHaveBeenCalled();
	});
});
