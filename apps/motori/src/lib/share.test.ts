import { describe, expect, it } from "vitest";
import { buildShareLinks } from "./share";

describe("buildShareLinks", () => {
	it("builds whatsapp and facebook links for a sample title and url", () => {
		const links = buildShareLinks(
			"https://motori.fi/pyorat/myynti/kawasaki-z650-helsinki",
			"Kawasaki Z650",
		);

		expect(links.whatsapp).toBe(
			"https://wa.me/?text=Kawasaki%20Z650%20https%3A%2F%2Fmotori.fi%2Fpyorat%2Fmyynti%2Fkawasaki-z650-helsinki",
		);
		expect(links.facebook).toBe(
			"https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fmotori.fi%2Fpyorat%2Fmyynti%2Fkawasaki-z650-helsinki",
		);
	});

	it("percent-encodes spaces, ampersands, question marks, Finnish characters and emoji", () => {
		const links = buildShareLinks(
			"https://motori.fi/pyorat/myynti/x?ref=jaa&utm=1",
			"Hämeenlinnan mökkipyörä 🏍️ & varusteet?",
		);

		expect(links.whatsapp).toBe(
			"https://wa.me/?text=H%C3%A4meenlinnan%20m%C3%B6kkipy%C3%B6r%C3%A4%20%F0%9F%8F%8D%EF%B8%8F%20%26%20varusteet%3F%20https%3A%2F%2Fmotori.fi%2Fpyorat%2Fmyynti%2Fx%3Fref%3Djaa%26utm%3D1",
		);
		expect(links.facebook).toBe(
			"https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fmotori.fi%2Fpyorat%2Fmyynti%2Fx%3Fref%3Djaa%26utm%3D1",
		);
	});
});
