import type { ListingCategory } from "~/lib/db/schema";
import type { ListingFormData } from "~/lib/validators";

export interface SharedPayload {
	title: string;
	city: string;
	region: string;
	postal_code: string | null;
	description: string;
	images: { url: string; thumbnail_url?: string | null }[];
}

/** Motorcycle fields shared between rental and sale categories. */
export interface MotorcyclePayload {
	make_id: string;
	model_id: string | null;
	year: number;
	engine_cc: number | null;
	motorcycle_type: string;
	required_license: "A1" | "A2" | "A" | null;
}

// Each category section is an adapter: it owns its defaults, its rendered
// fields (registered into the shared TanStack Form instance), and the
// transform that converts raw form values into the discriminated payload
// branch this category produces.
//
// `FieldValues` is the shape of the section's own slice of form state.
// The shell merges all sections' defaults into one flat form value.
export interface CategoryFormSection<C extends ListingCategory, FieldValues> {
	category: C;
	defaultValues: (initial?: Partial<ListingFormData>) => FieldValues;
	fieldKeys: readonly (keyof FieldValues)[];
	toPayload: (
		shared: SharedPayload,
		value: FieldValues,
		moto?: MotorcyclePayload,
	) => Extract<ListingFormData, { category: C }>;
}
