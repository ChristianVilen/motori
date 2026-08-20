import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { waitForHydration } from "../helpers";

const PAGES = [
	{ name: "Home", path: "/" },
	{ name: "Browse listings", path: "/pyorat/vuokraus" },
	{ name: "Login", path: "/kirjaudu" },
	{ name: "Register", path: "/rekisteroidy" },
	{ name: "Forgot password", path: "/unohdin-salasanan" },
	{ name: "Terms", path: "/kayttoehdot" },
	{ name: "Privacy", path: "/tietosuoja" },
];

async function expectNoSeriousViolations(page: Page) {
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
		.exclude('[aria-hidden="true"]')
		.analyze();

	expect(
		results.violations.filter((v) => v.impact === "critical" || v.impact === "serious"),
	).toEqual([]);
}

for (const { name, path } of PAGES) {
	test(`${name} (${path}) has no critical a11y violations`, async ({ page }) => {
		await page.goto(path);
		await waitForHydration(page);
		await expectNoSeriousViolations(page);
	});
}

for (const cat of ["sale", "gear", "part", "rental"] as const) {
	test(`Listing form (${cat}) with validation errors has no critical a11y violations`, async ({
		authenticatedPage: page,
	}) => {
		await page.goto("/ilmoitukset/uusi");
		await waitForHydration(page);
		await page.getByTestId(`category-tile-${cat}`).click();
		await page.getByTestId("listing-form-submit").click();
		await expect(page.locator("#title-error")).toBeVisible();
		await expectNoSeriousViolations(page);
	});
}
