// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { expect, it } from "vitest";
import { createI18nSync } from "~/lib/i18n/server";
import { ListingFacts } from "./listing-facts";

it("shows the Finnish part category on the detail page", () => {
	render(
		<I18nextProvider i18n={createI18nSync("fi")}>
			<ListingFacts
				data={{
					listing: { year: null, engine_cc: null, required_license: null },
					sale: null,
					gear: null,
					rental: null,
					part: {
						listing_id: "part-1",
						price: 5000,
						part_category: "brakes",
						condition: "good",
						oem_number: null,
						compatible_make_id: null,
						compatible_model_id: null,
						compatible_make_name: null,
						compatible_model_name: null,
					},
				}}
			/>
		</I18nextProvider>,
	);
	expect(screen.getByText("Osaluokka").nextElementSibling?.textContent).toBe("Jarrut");
});
