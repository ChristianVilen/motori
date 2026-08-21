import { expect, test } from "../fixtures";
import { ListingFormPage } from "../pages/listing-form.page";

// Validation is revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }):
// before a submit attempt errors appear/clear on blur, after it on change.
test("listing form errors are announced and linked to their inputs", async ({
	authenticatedPage: page,
}) => {
	const form = new ListingFormPage(page);
	await form.gotoCreate();
	await page.getByTestId("category-tile-sale").click();

	// Blur without typing: the error is rendered, announced politely, and wired to the input.
	await form.titleInput.focus();
	await page.keyboard.press("Tab");
	const titleError = page.locator("#title-error");
	await expect(titleError).toBeVisible();
	await expect(titleError).toHaveAttribute("aria-live", "polite");
	await expect(form.titleInput).toHaveAttribute("aria-invalid", "true");
	await expect(form.titleInput).toHaveAttribute("aria-describedby", "title-error");

	// Fix the value and blur again: the message and its aria wiring go away; the live
	// region itself stays mounted so the next message is announced.
	await form.titleInput.fill("Honda CB500 2005");
	await page.keyboard.press("Tab");
	await expect(titleError).toBeEmpty();
	await expect(form.titleInput).not.toHaveAttribute("aria-invalid");
	await expect(form.titleInput).not.toHaveAttribute("aria-describedby");

	// Submit with the rest empty: only the banner is assertive, every remaining field is
	// flagged, and focus lands on the first invalid control in DOM order (title is valid now).
	await form.submitButton.click();
	await expect(page.getByRole("alert")).toHaveCount(1);
	await expect(page.getByRole("alert")).toContainText("Tarkista");
	await expect(form.makeTrigger).toBeFocused();
	await expect(page.locator("#sale_price-error")).toBeVisible();
	const price = page.locator("#sale_price");
	await expect(price).toHaveAttribute("aria-invalid", "true");
	await expect(price).toHaveAttribute("aria-describedby", "sale_price-error");
	// CitySelect (Base UI Combobox.Input) must forward the aria props to the real <input>.
	await expect(page.locator("#city-error")).toBeVisible();
	await expect(form.cityInput).toHaveAttribute("aria-invalid", "true");
	await expect(form.cityInput).toHaveAttribute("aria-describedby", "city-error");
});

test("submitting an empty listing form focuses the first invalid field", async ({
	authenticatedPage: page,
}) => {
	const form = new ListingFormPage(page);
	await form.gotoCreate();
	await page.getByTestId("category-tile-sale").click();

	await form.submitButton.click();
	await expect(page.getByRole("alert")).toHaveCount(1);
	await expect(page.locator("#title-error")).toBeVisible();
	await expect(form.titleInput).toBeFocused();
});
