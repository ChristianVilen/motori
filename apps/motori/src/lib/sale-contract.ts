import { z } from "zod";
import { formatPower } from "./power";

const partyFields = [
	"lastName",
	"firstNames",
	"identity",
	"address",
	"postalCode",
	"city",
	"phone",
] as const;

export const fieldNames = {
	vehicle: ["registration", "vin", "make", "model", "year", "mileage", "color", "power"],
	seller: partyFields,
	buyer: partyFields,
	sale: ["price", "place", "date", "time"],
	payment: ["paymentMethod", "paymentTime"],
	accessories: ["keys", "serviceBook", "otherItems"],
	signatures: ["sellerName", "buyerName"],
} as const;

export type FieldGroup = keyof typeof fieldNames;
export type FieldName<Group extends FieldGroup> = (typeof fieldNames)[Group][number];

function fieldGroup<const Keys extends readonly [string, ...string[]]>(keys: Keys) {
	return z.record(z.enum(keys), z.string());
}

const optionalBlocks = ["payment", "accessories", "assurances", "defects", "terms"] as const;
export const statements = ["testDriven", "ownsVehicle", "debtFree", "noDrivingBan"] as const;

const removableSchema = z.enum([...optionalBlocks, ...statements]);

const contractSchema = z.object({
	vehicle: fieldGroup(fieldNames.vehicle),
	seller: fieldGroup(fieldNames.seller),
	buyer: fieldGroup(fieldNames.buyer),
	sale: fieldGroup(fieldNames.sale),
	payment: fieldGroup(fieldNames.payment),
	accessories: fieldGroup(fieldNames.accessories),
	defects: z.string(),
	terms: z.string(),
	signatures: fieldGroup(fieldNames.signatures),
	removed: z.array(removableSchema),
});

export type Contract = z.infer<typeof contractSchema>;
export type OptionalBlock = (typeof optionalBlocks)[number];
export type Statement = (typeof statements)[number];
export type Removable = z.infer<typeof removableSchema>;

export function fieldId<Group extends FieldGroup>(group: Group, key: FieldName<Group>): string {
	return `${group}-${key}`;
}

export type SalePrefill = {
	make: string | null;
	model: string | null;
	year: number | null;
	km_driven: number | null;
	color: string | null;
	power_kw: number | null;
	price: number;
};

const priceFormat = new Intl.NumberFormat("fi-FI", {
	useGrouping: false,
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export function createContract(listing: SalePrefill | null): Contract {
	const contract = blankContract();

	if (!listing) {
		return contract;
	}

	return {
		...contract,
		vehicle: {
			...contract.vehicle,
			make: listing.make ?? "",
			model: listing.model ?? "",
			year: listing.year?.toString() ?? "",
			mileage: listing.km_driven?.toString() ?? "",
			color: listing.color ?? "",
			power: listing.power_kw == null ? "" : formatPower(listing.power_kw),
		},
		sale: { ...contract.sale, price: priceFormat.format(listing.price / 100) },
	};
}

function blankContract(): Contract {
	return {
		vehicle: blankFields(fieldNames.vehicle),
		seller: blankFields(fieldNames.seller),
		buyer: blankFields(fieldNames.buyer),
		sale: blankFields(fieldNames.sale),
		payment: blankFields(fieldNames.payment),
		accessories: blankFields(fieldNames.accessories),
		defects: "",
		terms: "",
		signatures: blankFields(fieldNames.signatures),
		removed: [],
	};
}

function blankFields<const Keys extends readonly [string, ...string[]]>(keys: Keys) {
	return fieldGroup(keys).parse(Object.fromEntries(keys.map((key) => [key, ""])));
}

export function remove(draft: Contract, id: Removable): Contract {
	return { ...draft, removed: [...new Set([...draft.removed, id])] };
}

export function restore(draft: Contract, id: Removable): Contract {
	return { ...draft, removed: draft.removed.filter((removed) => removed !== id) };
}

export function parseDraft(value: string | null): Contract | null {
	if (!value) {
		return null;
	}

	try {
		const parsed = contractSchema.safeParse(JSON.parse(value));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

// sessionStorage throws when the browser blocks site data. The form then works without a saved draft.
export function readDraft(key: string): Contract | null {
	try {
		return parseDraft(window.sessionStorage.getItem(key));
	} catch {
		return null;
	}
}

export function saveDraft(key: string, draft: Contract) {
	try {
		window.sessionStorage.setItem(key, JSON.stringify(draft));
	} catch {
		// Blocked storage: see readDraft.
	}
}

export function normalizeListingQuery(value: unknown): string | undefined {
	return typeof value === "string" && /^[a-zA-Z0-9]{1,32}$/.test(value) ? value : undefined;
}

export function draftKey(listing: string | undefined): string {
	return listing ? `motori:sale-contract:v1:listing:${listing}` : "motori:sale-contract:v1:blank";
}
