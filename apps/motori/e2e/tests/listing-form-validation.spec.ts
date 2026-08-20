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

	// Blur without typing: the error is rendered, announced, and wired to the input.
	await form.titleInput.focus();
	await page.keyboard.press("Tab");
	const titleError = page.locator("#title-error");
	await expect(titleError).toBeVisible();
	await expect(titleError).toHaveAttribute("role", "alert");
	await expect(form.titleInput).toHaveAttribute("aria-invalid", "true");
	await expect(form.titleInput).toHaveAttribute("aria-describedby", "title-error");

	// Fix the value and blur again: the error and its aria wiring go away.
	await form.titleInput.fill("Honda CB500 2005");
	await page.keyboard.press("Tab");
	await expect(titleError).toHaveCount(0);
	await expect(form.titleInput).not.toHaveAttribute("aria-invalid");
	await expect(form.titleInput).not.toHaveAttribute("aria-describedby");

	// Submit with the rest empty: the banner is announced and every remaining field is flagged.
	await form.submitButton.click();
	await expect(page.getByRole("alert").filter({ hasText: "Tarkista" })).toBeVisible();
	await expect(page.locator("#sale_price-error")).toBeVisible();
	const price = page.locator("#sale_price");
	await expect(price).toHaveAttribute("aria-invalid", "true");
	await expect(price).toHaveAttribute("aria-describedby", "sale_price-error");
	// CitySelect (Base UI Combobox.Input) must forward the aria props to the real <input>.
	await expect(page.locator("#city-error")).toBeVisible();
	await expect(form.cityInput).toHaveAttribute("aria-invalid", "true");
	await expect(form.cityInput).toHaveAttribute("aria-describedby", "city-error");
});
