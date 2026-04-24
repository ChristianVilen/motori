import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { waitForHydration } from "../helpers";

const PAGES = [
	{ name: "Home", path: "/" },
	{ name: "Browse listings", path: "/ilmoitukset" },
	{ name: "Login", path: "/kirjaudu" },
	{ name: "Register", path: "/rekisteroidy" },
	{ name: "Forgot password", path: "/unohdin-salasanan" },
	{ name: "Terms", path: "/kayttoehdot" },
	{ name: "Privacy", path: "/tietosuoja" },
];

for (const { name, path } of PAGES) {
	test(`${name} (${path}) has no critical a11y violations`, async ({ page }) => {
		await page.goto(path);
		await waitForHydration(page);

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		expect(
			results.violations.filter((v) => v.impact === "critical" || v.impact === "serious"),
		).toEqual([]);
	});
}
