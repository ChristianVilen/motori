import { describe, expect, it } from "vitest";
import { publicAuthResponse } from "./public-session-user";

describe("publicAuthResponse", () => {
	it.each([
		["an empty body", ""],
		["a non-JSON body", "<html></html>"],
	])("returns the original response for %s", async (_name, body) => {
		const response = new Response(body, { status: 200 });
		await expect(publicAuthResponse(response)).resolves.toBe(response);
	});

	it("removes a member role and keeps the other fields", async () => {
		const response = Response.json(
			{ session: { id: "s1" }, user: { id: "u1", role: "user" } },
			{ headers: { "set-cookie": "a=b" } },
		);
		const result = await publicAuthResponse(response);
		expect(await result.json()).toEqual({ session: { id: "s1" }, user: { id: "u1" } });
		expect(result.headers.get("set-cookie")).toBe("a=b");
	});

	it("keeps the admin role", async () => {
		const response = Response.json({ user: { id: "u1", role: "admin" } });
		await expect(publicAuthResponse(response)).resolves.toBe(response);
	});
});
