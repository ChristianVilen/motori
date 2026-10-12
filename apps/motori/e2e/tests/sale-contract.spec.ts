import { expect, test } from "../fixtures";
import { CONTRACT_LISTING_ID, CONTRACT_LISTING_SLUG, SEEDED_LISTING_ID } from "../global-setup";
import { ListingDetailPage } from "../pages/listing-detail.page";
import { SaleContractPage } from "../pages/sale-contract.page";

test("public sale contract stays local, restores edits and prints the preview", async ({
	page,
}) => {
	const contract = new SaleContractPage(page);
	const detail = new ListingDetailPage(page);
	const marker = "ContractPrivateMarker748";
	const statement = "Ajoneuvo on velaton.";
	const requests: string[] = [];
	let contractUrl = "";

	page.on("request", (request) => requests.push(`${request.url()} ${request.postData() ?? ""}`));

	await test.step("opens blank without a listing and prefilled with one", async () => {
		await contract.goto();
		await expect(contract.field("vehicle", "make")).toHaveValue("");

		await contract.goto(CONTRACT_LISTING_ID);
		await expect(contract.field("vehicle", "make")).toHaveValue("Honda");
	});

	await test.step("the sale listing links to a prefilled contract", async () => {
		await detail.gotoSale(CONTRACT_LISTING_ID, CONTRACT_LISTING_SLUG);
		await detail.saleContractLink.click();
		await contract.waitForReady();
		await expect(page).toHaveURL(/\/kauppakirja\?ilmoitus=/);
		contractUrl = page.url();

		await expect(contract.field("vehicle", "make")).toHaveValue("Honda");
		await expect(contract.field("vehicle", "model")).toHaveValue("CB500F");
		await expect(contract.field("vehicle", "year")).toHaveValue("2022");
		await expect(contract.field("vehicle", "mileage")).toHaveValue("12345");
		await expect(contract.field("vehicle", "power")).toHaveValue("35 kW (48 hv)");
		await expect(contract.field("sale", "price")).toHaveValue("4500,50");
		await expect(contract.field("seller", "lastName")).toHaveValue("");
	});

	await test.step("typed values survive a reload and Enter submits nothing", async () => {
		await contract.field("seller", "lastName").fill(marker);
		await contract.field("buyer", "firstNames").fill(`${marker}Buyer`);
		await contract.field("seller", "lastName").press("Enter");

		await contract.reload();
		await expect(contract.field("seller", "lastName")).toHaveValue(marker);
	});

	await test.step("a removed statement does not print", async () => {
		await contract.previewButton.click();
		await expect(contract.document).toContainText(marker);
		await expect(contract.removeButton("Myyjä")).toHaveCount(0);

		await contract.removeButton(statement).click();
		await expect(contract.restoreButton(statement)).toBeVisible();

		await page.emulateMedia({ media: "print" });
		await expect(contract.restoreButton(statement)).toBeHidden();
		await expect(contract.documentText(statement)).toBeHidden();
		await expect(contract.documentText("Myyjä omistaa ajoneuvon.")).toBeVisible();
		await expect(contract.navigation).toBeHidden();
		await expect(contract.document).toContainText("Motori ei ole kaupan osapuoli.");

		await page.emulateMedia({ media: "screen" });
		await contract.restoreButton(statement).click();
		await expect(contract.documentText(statement)).toBeVisible();
	});

	await test.step("clear removes typed and listing values", async () => {
		await contract.clearButton.click();
		await contract.reload();

		await expect(contract.field("seller", "lastName")).toHaveValue("");
		await expect(contract.field("vehicle", "make")).toHaveValue("");
		await expect(contract.field("sale", "price")).toHaveValue("");
		await expect(page).toHaveURL(contractUrl);
	});

	await test.step("other listings open the blank form", async () => {
		await contract.goto(SEEDED_LISTING_ID);
		await expect(contract.field("vehicle", "make")).toHaveValue("");

		await contract.goto("unknown1");
		await expect(contract.field("vehicle", "make")).toHaveValue("");
		await expect(contract.canonicalLink).toHaveAttribute("href", /\/kauppakirja$/);
	});

	expect(requests.some((request) => request.includes(marker))).toBe(false);
});
