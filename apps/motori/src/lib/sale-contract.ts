import { z } from "zod";
import { formatPower } from "./power";

const partySchema = z.object({
	lastName: z.string(),
	firstNames: z.string(),
	identity: z.string(),
	address: z.string(),
	postalCode: z.string(),
	city: z.string(),
	phone: z.string(),
});
const optionalBlockSchema = z.enum(["payment", "accessories", "assurances", "defects", "terms"]);
const statementSchema = z.enum(["testDriven", "ownsVehicle", "debtFree", "noDrivingBan"]);

const contractSchema = z.object({
	vehicle: z.object({
		registration: z.string(),
		vin: z.string(),
		make: z.string(),
		model: z.string(),
		year: z.string(),
		mileage: z.string(),
		color: z.string(),
		power: z.string(),
	}),
	seller: partySchema,
	buyer: partySchema,
	sale: z.object({
		price: z.string(),
		place: z.string(),
		date: z.string(),
		time: z.string(),
		sellerName: z.string(),
		buyerName: z.string(),
	}),
	optional: z.object({
		paymentMethod: z.string(),
		paymentTime: z.string(),
		keys: z.string(),
		serviceBook: z.string(),
		otherItems: z.string(),
		defects: z.string(),
		terms: z.string(),
	}),
	removedBlocks: z.array(optionalBlockSchema),
	removedStatements: z.array(statementSchema),
});

export type Contract = z.infer<typeof contractSchema>;
export type OptionalBlock = z.infer<typeof optionalBlockSchema>;
export type Statement = z.infer<typeof statementSchema>;
export const statements = statementSchema.options;

export type SalePrefill = {
	make: string | null;
	model: string | null;
	year: number | null;
	km_driven: number | null;
	color: string | null;
	power_kw: number | null;
	price: number;
};

export function createContract(listing: SalePrefill | null): Contract {
	const party = {
		lastName: "",
		firstNames: "",
		identity: "",
		address: "",
		postalCode: "",
		city: "",
		phone: "",
	};
	return {
		vehicle: {
			registration: "",
			vin: "",
			make: listing?.make ?? "",
			model: listing?.model ?? "",
			year: listing?.year?.toString() ?? "",
			mileage: listing?.km_driven?.toString() ?? "",
			color: listing?.color ?? "",
			power: listing?.power_kw == null ? "" : formatPower(listing.power_kw),
		},
		seller: { ...party },
		buyer: { ...party },
		sale: {
			price: listing
				? new Intl.NumberFormat("fi-FI", {
						useGrouping: false,
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					}).format(listing.price / 100)
				: "",
			place: "",
			date: "",
			time: "",
			sellerName: "",
			buyerName: "",
		},
		optional: {
			paymentMethod: "",
			paymentTime: "",
			keys: "",
			serviceBook: "",
			otherItems: "",
			defects: "",
			terms: "",
		},
		removedBlocks: [],
		removedStatements: [],
	};
}

export function removeBlock(draft: Contract, block: OptionalBlock): Contract {
	return { ...draft, removedBlocks: [...new Set([...draft.removedBlocks, block])] };
}
export function restoreBlock(draft: Contract, block: OptionalBlock): Contract {
	return { ...draft, removedBlocks: draft.removedBlocks.filter((id) => id !== block) };
}
export function removeStatement(draft: Contract, statement: Statement): Contract {
	return { ...draft, removedStatements: [...new Set([...draft.removedStatements, statement])] };
}
export function restoreStatement(draft: Contract, statement: Statement): Contract {
	return { ...draft, removedStatements: draft.removedStatements.filter((id) => id !== statement) };
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

export function normalizeListingQuery(value: unknown): string | undefined {
	return typeof value === "string" && /^[a-zA-Z0-9]{1,32}$/.test(value) ? value : undefined;
}
export function draftKey(listing: string | undefined): string {
	return listing ? `motori:sale-contract:v1:listing:${listing}` : "motori:sale-contract:v1:blank";
}
