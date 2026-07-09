import { expect, test } from "../fixtures";
import { waitForHydration } from "../helpers";

test.describe("talli happy path", () => {
	test.describe.configure({ mode: "serial" });

	test("SSO session from motori works on talli", async ({ authenticatedPage: page }) => {
		await page.goto("/");
		await waitForHydration(page);
		await expect(page.getByTestId("nav-signout")).toBeVisible();
	});

	test("add vehicle with presets, complete a reminder, verify timeline", async ({
		authenticatedPage: page,
	}) => {
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("garage-add-vehicle").click();
		await page.waitForURL("**/pyorat/uusi");
		await waitForHydration(page);

		await page.getByTestId("vehicle-make").fill("Honda");
		await page.getByTestId("vehicle-model").fill("CB500F");
		await page.getByTestId("vehicle-year").fill("2022");
		await page.getByTestId("vehicle-odometer").fill("12000");
		// Vakuutus and ajoneuvovero are both date-type presets checked by default, so
		// two required recurrence-date-0 inputs exist (Vakuutus first, ajoneuvovero
		// second — REMINDER_PRESETS order); both must be filled or the browser's
		// native required-field validation blocks the submit.
		const recurrenceDateInputs = page.getByTestId("recurrence-date-0");
		await recurrenceDateInputs.nth(0).fill("2027-03-15");
		await recurrenceDateInputs.nth(1).fill("2027-05-20");
		await page.getByTestId("vehicle-form-submit").click();
		await page.waitForURL(/\/pyorat\/[0-9a-f-]{36}$/, { timeout: 15_000 });
		await waitForHydration(page);

		await expect(page.getByTestId("vehicle-title")).toHaveText("Honda CB500F");
		await expect(page.getByTestId("reminder-row")).toHaveCount(5);
		await expect(page.getByTestId("parts-search-link")).toHaveAttribute(
			"href",
			/varaosat\?q=Honda(%20|\+)CB500F/,
		);

		// öljynvaihto due at 12000+6000=18000; 17600 leaves 400 km ≤ 500 → due_soon.
		await page.getByTestId("odometer-input").fill("17600");
		await page.getByTestId("odometer-submit").click();
		await expect(page.getByTestId("vehicle-odometer-value")).toHaveText(/17\s?600/);
		const oljynvaihtoRow = page.locator(
			'[data-testid="reminder-row"][data-reminder-title="Öljynvaihto"]',
		);
		await expect(oljynvaihtoRow.getByTestId("due-badge")).toHaveAttribute(
			"data-status",
			"due_soon",
		);

		await oljynvaihtoRow.getByRole("link", { name: "Merkitse tehdyksi" }).click();
		await page.waitForURL(/\/huolto\/uusi\?reminder=/);
		await waitForHydration(page);
		await expect(page.getByTestId("completing-reminder")).toContainText("Öljynvaihto");
		await expect(page.getByTestId("service-title")).toHaveValue("Öljynvaihto");
		await page.getByTestId("service-odometer").fill("17650");
		await page.getByTestId("service-cost").fill("89");
		await page.getByTestId("service-form-submit").click();
		await page.waitForURL(/\/pyorat\/[0-9a-f-]{36}$/, { timeout: 15_000 });
		await waitForHydration(page);

		await expect(page.getByTestId("service-record")).toHaveCount(1);
		await expect(page.getByTestId("service-record")).toContainText("Öljynvaihto");
		// Re-anchored to 17650 + 6000 = 23650 vs odometer 17650 → 6000 km left → ok.
		await expect(oljynvaihtoRow.getByTestId("due-badge")).toHaveAttribute("data-status", "ok");

		// Vakuutus (2027-03-15) is a payment reminder — mark-paid advances it to the
		// next annual anchor (2028-03-15) instead of opening the service-record form.
		const vakuutusRow = page.locator(
			'[data-testid="reminder-row"][data-reminder-title="Vakuutus"]',
		);
		await expect(vakuutusRow.getByTestId("due-badge")).toHaveAttribute("data-status", "ok");
		await vakuutusRow.getByTestId("mark-paid-Vakuutus").click();
		await expect(page.getByTestId("reminder-row")).toHaveCount(5);
		await expect(vakuutusRow).toBeVisible();
		await expect(vakuutusRow.getByTestId("due-badge")).toHaveAttribute("data-status", "ok");
	});
});
