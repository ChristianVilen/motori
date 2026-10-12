import { expect, type Locator, type Page } from "@playwright/test";
import { type FieldGroup, type FieldName, fieldId } from "../../src/lib/sale-contract";
import { waitForHydration } from "../helpers";

export class SaleContractPage {
	readonly page: Page;
	readonly document: Locator;
	readonly previewButton: Locator;
	readonly clearButton: Locator;
	readonly canonicalLink: Locator;
	readonly navigation: Locator;

	constructor(page: Page) {
		this.page = page;
		this.document = page.getByTestId("contract-document");
		this.previewButton = page.getByRole("button", { name: "Esikatselu", exact: true });
		this.clearButton = page.getByRole("button", { name: "Tyhjennä lomake", exact: true });
		this.canonicalLink = page.locator('link[rel="canonical"]');
		this.navigation = page.getByRole("navigation").first();
	}

	async goto(listingId?: string) {
		const query = listingId ? `?${new URLSearchParams({ ilmoitus: listingId })}` : "";
		await this.page.goto(`/kauppakirja${query}`);
		await this.waitForReady();
	}

	async waitForReady() {
		await waitForHydration(this.page);
		await expect(this.previewButton).toBeVisible();
	}

	async reload() {
		await this.page.reload();
		await this.waitForReady();
	}

	field<Group extends FieldGroup>(group: Group, key: FieldName<Group>): Locator {
		return this.page.locator(`#${fieldId(group, key)}`);
	}

	removeButton(name: string): Locator {
		return this.document.getByRole("button", { name: `Poista ${name}`, exact: true });
	}

	restoreButton(name: string): Locator {
		return this.document.getByRole("button", { name: `Palauta ${name}`, exact: true });
	}

	documentText(text: string): Locator {
		return this.document.getByText(text, { exact: true });
	}
}
