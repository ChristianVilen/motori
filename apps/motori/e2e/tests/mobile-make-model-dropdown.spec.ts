import { expect, test } from "../fixtures";
import { waitForHydration } from "../helpers";

test.beforeEach(async ({ authenticatedPage: page }) => {
	await page.goto("/ilmoitukset/uusi");
	await waitForHydration(page);
	await page.getByTestId("category-tile-rental").click();
});

test("make and model text fields stay at 16px on a phone", async ({ authenticatedPage: page }) => {
	await page.locator("#make-trigger").click();
	await expect(page.locator("#make-filter")).toBeFocused();
	await expect(page.locator("#make-filter")).toHaveCSS("font-size", "16px");
	await page.getByRole("button", { name: "Ei löydy listalta — lisää uusi" }).click();
	await expect(page.locator("#new-make-name")).toHaveCSS("font-size", "16px");
	await page.getByRole("button", { name: "Peruuta" }).click();
	await page.getByRole("button", { name: "Honda", exact: true }).first().click();

	await page.locator("#model-trigger").click();
	await expect(page.locator("#model-filter")).toBeFocused();
	await expect(page.locator("#model-filter")).toHaveCSS("font-size", "16px");
	await page.getByRole("button", { name: "Ei löydy listalta — lisää uusi" }).click();
	await expect(page.locator("#new-model-name")).toHaveCSS("font-size", "16px");
});

test("make and model add actions stay above the nav in a short viewport", async ({
	authenticatedPage: page,
}) => {
	await page.setViewportSize({ width: 393, height: 550 });

	async function expectMenuAboveNav(triggerId: string, filterId: string) {
		await page.locator(triggerId).evaluate(
			(trigger, top) => {
				window.scrollBy(0, trigger.getBoundingClientRect().top - top);
			},
			triggerId === "#make-trigger" ? 100 : 380,
		);
		await page.locator(triggerId).click();
		await expect(page.locator(filterId)).toBeFocused();
		await page.setViewportSize({ width: 393, height: 400 });
		await expect
			.poll(() =>
				page.locator(filterId).evaluate((filter) => {
					const panel = filter.parentElement?.parentElement;
					const nav = document.querySelector('[data-testid="bottom-nav-add"]')?.closest("nav");
					if (!panel || !nav) {
						throw new Error("Dropdown or bottom nav is missing");
					}
					return panel.getBoundingClientRect().bottom - nav.getBoundingClientRect().top;
				}),
			)
			.toBeLessThanOrEqual(0);

		const menuPosition = await page.locator(filterId).evaluate((filter) => {
			const panel = filter.parentElement?.parentElement;
			const nav = document.querySelector('[data-testid="bottom-nav-add"]')?.closest("nav");
			const add = Array.from(panel?.querySelectorAll("button") ?? []).find((button) =>
				button.textContent?.includes("Ei löydy listalta"),
			);
			if (!panel || !nav || !add) {
				throw new Error("Dropdown, add action, or bottom nav is missing");
			}
			const panelBox = panel.getBoundingClientRect();
			const navBox = nav.getBoundingClientRect();
			const addBox = add.getBoundingClientRect();
			const topElement = document.elementFromPoint(
				addBox.left + addBox.width / 2,
				addBox.top + addBox.height / 2,
			);
			return {
				panelTop: panelBox.top,
				panelBottom: panelBox.bottom,
				navTop: navBox.top,
				viewportBottom:
					(window.visualViewport?.offsetTop ?? 0) +
					(window.visualViewport?.height ?? window.innerHeight),
				addIsTappable: topElement === add || add.contains(topElement),
			};
		});
		expect(menuPosition.panelTop).toBeGreaterThanOrEqual(0);
		expect(menuPosition.panelBottom).toBeLessThanOrEqual(menuPosition.navTop);
		expect(menuPosition.panelBottom).toBeLessThanOrEqual(menuPosition.viewportBottom);
		expect(menuPosition.addIsTappable).toBe(true);
		await page.getByRole("button", { name: "Ei löydy listalta — lisää uusi" }).click();
		await expect(page.getByRole("button", { name: "Peruuta" })).toBeVisible();
		await page.getByRole("button", { name: "Peruuta" }).click();
		await page.setViewportSize({ width: 393, height: 550 });
	}

	await expectMenuAboveNav("#make-trigger", "#make-filter");
	await page.getByRole("button", { name: "Honda", exact: true }).first().click();
	await expectMenuAboveNav("#model-trigger", "#model-filter");
});
