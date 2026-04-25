# Motorcycle Makes & Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text `brand`/`model` columns on `listing` with a DB-backed `motorcycle_make`/`motorcycle_model` catalog; users can add missing makes or models inline from the listing form.

**Architecture:** New tables `motorcycle_make` and `motorcycle_model` referenced by FK from `listing`. A custom `MakeModelSelect` combobox component loads makes on mount, fetches models per make selection, and allows inline creation of missing entries. The FTS trigger is updated to pull make/model names via subselects.

**Tech Stack:** Kysely migrations, TanStack Form `form.Field` + `form.setFieldValue`, `createServerFn` (GET/POST), React controlled combobox, Vitest unit tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/db/migrations/007_makes_models.ts` | Schema migration |
| Modify | `src/lib/db/schema.ts` | Add new table types, update ListingTable |
| Modify | `src/lib/db/seed.ts` | Seed makes/models; update listing inserts |
| Modify | `e2e/global-setup.ts` | Insert make for e2e listing |
| Create | `src/lib/makes.ts` | Server fns: getMakes, getModels, createMake, createModel |
| Create | `src/lib/makes.test.ts` | Unit tests for toSlug |
| Modify | `src/lib/validators.ts` | brand→make_id, model→model_id |
| Modify | `src/lib/i18n/resources/fi/listings.ts` | Remove obsolete form.fields keys |
| Create | `src/components/listings/make-model-select.tsx` | Searchable combobox component |
| Modify | `src/components/listings/listing-form.tsx` | Replace brand/model fields with MakeModelSelect |
| Modify | `src/routes/ilmoitukset/uusi.tsx` | Update insert |
| Modify | `src/routes/ilmoitukset/$listingId_.muokkaa.tsx` | Update update query + initialValues |
| Modify | `src/routes/ilmoitukset/$listingId.tsx` | Join make/model names, update ListingSpecs |

---

## Task 1: DB Migration + Schema

**Files:**
- Create: `src/lib/db/migrations/007_makes_models.ts`
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Write migration**

```ts
// src/lib/db/migrations/007_makes_models.ts
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("motorcycle_make")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("slug", "text", (col) => col.notNull())
		.addColumn("approved", "boolean", (col) => col.notNull().defaultTo(true))
		.execute();

	await db.schema
		.createIndex("motorcycle_make_slug_idx")
		.on("motorcycle_make")
		.column("slug")
		.unique()
		.execute();

	await db.schema
		.createTable("motorcycle_model")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("make_id", "text", (col) =>
			col.notNull().references("motorcycle_make.id").onDelete("cascade"),
		)
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("approved", "boolean", (col) => col.notNull().defaultTo(true))
		.execute();

	await db.schema
		.createIndex("motorcycle_model_make_idx")
		.on("motorcycle_model")
		.column("make_id")
		.execute();

	// Add FK columns before dropping text columns so PG doesn't reject the table state
	await db.schema
		.alterTable("listing")
		.addColumn("make_id", "text", (col) => col.references("motorcycle_make.id"))
		.addColumn("model_id", "text", (col) => col.references("motorcycle_model.id"))
		.execute();

	await db.schema.alterTable("listing").dropColumn("brand").dropColumn("model").execute();

	// Update FTS trigger to read make/model names via subselects
	await sql`
		CREATE OR REPLACE FUNCTION listing_fts_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector :=
				setweight(to_tsvector('finnish', coalesce(NEW.title, '')), 'A') ||
				setweight(to_tsvector('finnish', coalesce((SELECT name FROM motorcycle_make WHERE id = NEW.make_id), '')), 'B') ||
				setweight(to_tsvector('finnish', coalesce((SELECT name FROM motorcycle_model WHERE id = NEW.model_id), '')), 'B') ||
				setweight(to_tsvector('finnish', coalesce(NEW.description, '')), 'C') ||
				setweight(to_tsvector('finnish', coalesce(NEW.city, '')), 'D') ||
				setweight(to_tsvector('finnish', coalesce(NEW.region, '')), 'D');
			RETURN NEW;
		END
		$$ LANGUAGE plpgsql
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`
		CREATE OR REPLACE FUNCTION listing_fts_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector :=
				setweight(to_tsvector('finnish', coalesce(NEW.title, '')), 'A') ||
				setweight(to_tsvector('finnish', coalesce(NEW.description, '')), 'C') ||
				setweight(to_tsvector('finnish', coalesce(NEW.city, '')), 'D') ||
				setweight(to_tsvector('finnish', coalesce(NEW.region, '')), 'D');
			RETURN NEW;
		END
		$$ LANGUAGE plpgsql
	`.execute(db);

	await db.schema
		.alterTable("listing")
		.dropColumn("make_id")
		.dropColumn("model_id")
		.addColumn("brand", "text", (col) => col.notNull().defaultTo(""))
		.addColumn("model", "text", (col) => col.notNull().defaultTo(""))
		.execute();

	await db.schema.dropTable("motorcycle_model").execute();
	await db.schema.dropTable("motorcycle_make").execute();
}
```

- [ ] **Step 2: Update schema.ts**

Add after the `ProfileTable` block and before `ListingTable`:

```ts
export interface MotorcycleMakeTable {
	id: string;
	name: string;
	slug: string;
	approved: Generated<boolean>;
}

export interface MotorcycleModelTable {
	id: string;
	make_id: string;
	name: string;
	approved: Generated<boolean>;
}

export type MotorcycleMake = Selectable<MotorcycleMakeTable>;
export type MotorcycleModel = Selectable<MotorcycleModelTable>;
```

In `ListingTable`, replace:
```ts
	// remove these two lines:
	brand: string;
	model: string;
```
with:
```ts
	make_id: string | null; // nullable at DB level; app validator enforces required
	model_id: string | null;
```

Add to the `Database` interface:
```ts
	motorcycle_make: MotorcycleMakeTable;
	motorcycle_model: MotorcycleModelTable;
```

- [ ] **Step 3: Run migration and codegen**

```bash
pnpm db:migrate && pnpm db:codegen
```

Expected: migration `007_makes_models` logged, `schema.generated.ts` updated.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/migrations/007_makes_models.ts src/lib/db/schema.ts src/lib/db/schema.generated.ts
git commit -m "feat: add motorcycle_make and motorcycle_model tables (migration 007)"
```

---

## Task 2: Seed Data + E2E Setup

**Files:**
- Modify: `src/lib/db/seed.ts`
- Modify: `e2e/global-setup.ts`

- [ ] **Step 1: Update seed.ts**

Replace the entire file content. The key changes are: remove `brand`/`model` from `SeedListing`, add makes/models seeding block before listings, look up `make_id` by slug when inserting listings.

```ts
// biome-ignore-all lint/suspicious/noConsole: CLI script — console output is expected
import { auth } from "../auth";
import { db } from "./index";

const SEED_EMAIL = "dev@vuokramoto.local";
const SEED_PASSWORD = "devpassword";
const SEED_NAME = "Dev";

const IMG = (name: string) => `/images/${name}-1200w.webp`;
const TANK = IMG("kawasaki-tank-closeup");
const R6 = IMG("yamaha-r6-graffiti-sunset");
const FERRY = IMG("motorcycle-finnish-ferry");
const LINEUP = IMG("sportbikes-lineup");

type SeedListing = {
	title: string;
	makeSlug: string;
	year: number;
	engine_cc: number;
	required_license: "A1" | "A2" | "A";
	motorcycle_type: string;
	price_per_day: number;
	price_per_week: number | null;
	city: string;
	region: string;
	description: string;
	status?: "active" | "paused";
	images: string[];
};

const MAKES_SEED = [
	{ name: "Aprilia", slug: "aprilia" },
	{ name: "Beta", slug: "beta" },
	{ name: "BMW", slug: "bmw" },
	{ name: "Can-Am", slug: "can-am" },
	{ name: "Ducati", slug: "ducati" },
	{ name: "Energica", slug: "energica" },
	{ name: "GasGas", slug: "gasgas" },
	{ name: "Harley-Davidson", slug: "harley-davidson" },
	{ name: "Honda", slug: "honda" },
	{ name: "Husaberg", slug: "husaberg" },
	{ name: "Husqvarna", slug: "husqvarna" },
	{ name: "Indian", slug: "indian" },
	{ name: "Kawasaki", slug: "kawasaki" },
	{ name: "KTM", slug: "ktm" },
	{ name: "Moto Guzzi", slug: "moto-guzzi" },
	{ name: "Royal Enfield", slug: "royal-enfield" },
	{ name: "Sherco", slug: "sherco" },
	{ name: "Suzuki", slug: "suzuki" },
	{ name: "Triumph", slug: "triumph" },
	{ name: "Yamaha", slug: "yamaha" },
	{ name: "Zero", slug: "zero" },
	{ name: "Muu", slug: "muu" },
];

const MODELS_SEED: { makeSlug: string; models: string[] }[] = [
	{ makeSlug: "honda", models: ["CB500F", "CB650R", "CBR600RR", "Africa Twin", "NC750X", "Gold Wing"] },
	{ makeSlug: "yamaha", models: ["MT-07", "MT-09", "YZF-R1", "Ténéré 700", "TMAX", "MT-125"] },
	{ makeSlug: "kawasaki", models: ["Z650", "Z900", "Ninja 400", "Ninja 650", "Versys 650", "Ninja ZX-6R"] },
	{ makeSlug: "bmw", models: ["R 1250 GS", "S 1000 RR", "F 900 R", "R nineT", "R 1250 RT"] },
	{ makeSlug: "ktm", models: ["Duke 390", "Duke 790", "890 Adventure"] },
	{ makeSlug: "suzuki", models: ["GSX-S750", "V-Strom 650", "Hayabusa", "SV650"] },
	{ makeSlug: "harley-davidson", models: ["Sportster", "Street Glide", "Fat Boy", "Iron 883"] },
	{ makeSlug: "ducati", models: ["Monster", "Panigale V4", "Multistrada V4"] },
	{ makeSlug: "triumph", models: ["Bonneville", "Tiger 900", "Street Triple", "Tiger 900 GT"] },
	{ makeSlug: "aprilia", models: ["RS 660", "Tuono 660", "Shiver 900"] },
	{ makeSlug: "royal-enfield", models: ["Meteor 350", "Himalayan", "Classic 350"] },
	{ makeSlug: "husqvarna", models: ["Svartpilen 401", "Vitpilen 401"] },
	{ makeSlug: "zero", models: ["SR/F", "DSR/X"] },
	{ makeSlug: "indian", models: ["Scout", "Chief", "FTR 1200"] },
	{ makeSlug: "moto-guzzi", models: ["V7", "V9", "V100 Mandello"] },
	{ makeSlug: "can-am", models: ["Ryker", "Spyder F3"] },
	{ makeSlug: "energica", models: ["Ego", "Eva"] },
	{ makeSlug: "beta", models: ["RR 125", "RR 300"] },
	{ makeSlug: "gasgas", models: ["EC 250", "MC 350F"] },
	{ makeSlug: "husaberg", models: ["FE 501", "TE 300"] },
	{ makeSlug: "sherco", models: ["SE 300", "SEF 250"] },
];

const listings: SeedListing[] = [
	{
		title: "Yamaha YZF-R6 — varma ja nopea",
		makeSlug: "yamaha",
		year: 2018,
		engine_cc: 599,
		required_license: "A",
		motorcycle_type: "sport",
		price_per_day: 95,
		price_per_week: 550,
		city: "Helsinki",
		region: "uusimaa",
		description:
			"Hyvin huollettu R6, sopii kokeneelle kuljettajalle. Renkaat uudet keväällä, akrapovic-pakoputki.",
		images: [R6, LINEUP],
	},
	{
		title: "Kawasaki Ninja ZX-6R 636",
		makeSlug: "kawasaki",
		year: 2020,
		engine_cc: 636,
		required_license: "A",
		motorcycle_type: "sport",
		price_per_day: 110,
		price_per_week: 650,
		city: "Tampere",
		region: "pirkanmaa",
		description: "Vihreä Ninja, hyvässä kunnossa. Kypärä mukana, vakuutus omasta.",
		images: [LINEUP],
	},
	{
		title: "Kawasaki Z650 — kevyt naked",
		makeSlug: "kawasaki",
		year: 2022,
		engine_cc: 649,
		required_license: "A2",
		motorcycle_type: "naked",
		price_per_day: 65,
		price_per_week: 380,
		city: "Turku",
		region: "varsinais-suomi",
		description: "Loistava arkikäyttöön ja kaupunkiajoon. A2-rajoitettu.",
		images: [TANK],
	},
	{
		title: "Suzuki SV650 — kaupunkiajon klassikko",
		makeSlug: "suzuki",
		year: 2019,
		engine_cc: 645,
		required_license: "A2",
		motorcycle_type: "naked",
		price_per_day: 55,
		price_per_week: 320,
		city: "Espoo",
		region: "uusimaa",
		description: "Helppo ja luotettava. Sopii myös vasta-alkajalle (A2-luokka).",
		images: [FERRY],
	},
	{
		title: "BMW R 1250 RT — pitkien matkojen kuningas",
		makeSlug: "bmw",
		year: 2021,
		engine_cc: 1254,
		required_license: "A",
		motorcycle_type: "touring",
		price_per_day: 175,
		price_per_week: 1050,
		city: "Jyväskylä",
		region: "keski-suomi",
		description:
			"Täysvarustelu: cruise control, lämmittimet, sivulaukut. Ihanteellinen reissupyörä.",
		images: [LINEUP, FERRY],
	},
	{
		title: "Honda Goldwing 1800 — luksusta pitkille reissuille",
		makeSlug: "honda",
		year: 2017,
		engine_cc: 1832,
		required_license: "A",
		motorcycle_type: "touring",
		price_per_day: 165,
		price_per_week: 990,
		city: "Oulu",
		region: "pohjois-pohjanmaa",
		description: "Mukavin tapa kierrellä Lappia. Audio, GPS, lämpenevät kahvat ja istuin.",
		images: [FERRY],
	},
	{
		title: "KTM 890 Adventure — soraa ja asfalttia",
		makeSlug: "ktm",
		year: 2022,
		engine_cc: 889,
		required_license: "A",
		motorcycle_type: "adventure",
		price_per_day: 130,
		price_per_week: 750,
		city: "Rovaniemi",
		region: "lappi",
		description:
			"Loistava Lapin reissupyörä. Off-road-renkaat saatavissa pyynnöstä, pannarit mukana.",
		images: [LINEUP],
	},
	{
		title: "Triumph Tiger 900 GT",
		makeSlug: "triumph",
		year: 2020,
		engine_cc: 888,
		required_license: "A",
		motorcycle_type: "adventure",
		price_per_day: 120,
		price_per_week: 700,
		city: "Tampere",
		region: "pirkanmaa",
		description: "Mukava ja ketterä adventure-pyörä. Sivulaukut ja topcase mukana.",
		images: [FERRY],
	},
	{
		title: "Harley-Davidson Iron 883 — klassinen cruiseri",
		makeSlug: "harley-davidson",
		year: 2019,
		engine_cc: 883,
		required_license: "A2",
		motorcycle_type: "cruiser",
		price_per_day: 95,
		price_per_week: 580,
		city: "Helsinki",
		region: "uusimaa",
		description: "Mustan klassinen H-D. Sopii Helsinki–Hanko-reissuille kesäisin.",
		images: [TANK],
	},
	{
		title: "Yamaha MT-125 — A1-luokan arkipyörä",
		makeSlug: "yamaha",
		year: 2023,
		engine_cc: 125,
		required_license: "A1",
		motorcycle_type: "naked",
		price_per_day: 45,
		price_per_week: 250,
		city: "Lahti",
		region: "paijat-hame",
		description: "Vastuullinen ensimmäinen pyörä. A1-kortilla ajettava.",
		status: "paused",
		images: [TANK],
	},
];

async function main() {
	console.log("\n🌱 Seeding dev data...\n");

	// 1. Wipe previous seed user
	const existing = await db
		.selectFrom("user")
		.select("id")
		.where("email", "=", SEED_EMAIL)
		.executeTakeFirst();

	if (existing) {
		console.log(`Removing previous seed user (${existing.id})...`);
		await db.deleteFrom("user").where("id", "=", existing.id).execute();
	}

	// 2. Wipe and re-seed makes/models
	console.log("Seeding makes and models...");
	await db.deleteFrom("motorcycle_model").execute();
	await db.deleteFrom("motorcycle_make").execute();

	const insertedMakes = await db
		.insertInto("motorcycle_make")
		.values(MAKES_SEED.map((m) => ({ id: crypto.randomUUID(), ...m, approved: true })))
		.returningAll()
		.execute();

	const makeBySlug = Object.fromEntries(insertedMakes.map((m) => [m.slug, m]));

	const modelValues = MODELS_SEED.flatMap(({ makeSlug, models }) => {
		const make = makeBySlug[makeSlug];
		if (!make) return [];
		return models.map((name) => ({
			id: crypto.randomUUID(),
			make_id: make.id,
			name,
			approved: true,
		}));
	});

	await db.insertInto("motorcycle_model").values(modelValues).execute();

	// 3. Create user
	console.log(`Creating user ${SEED_EMAIL}...`);
	const result = await auth.api.signUpEmail({
		body: { email: SEED_EMAIL, password: SEED_PASSWORD, name: SEED_NAME },
	});
	const userId = result.user.id;

	await db
		.updateTable("user")
		.set({ emailVerified: true, updatedAt: new Date() })
		.where("id", "=", userId)
		.execute();

	// 4. Profile
	await db
		.insertInto("profile")
		.values({
			user_id: userId,
			display_name: SEED_NAME,
			city: "Helsinki",
			license_class: "A",
			language: "fi",
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	// 5. Listings + images
	console.log(`Creating ${listings.length} listings...`);
	const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

	for (const seed of listings) {
		const id = crypto.randomUUID();
		const make = makeBySlug[seed.makeSlug];
		if (!make) throw new Error(`Unknown make slug: ${seed.makeSlug}`);

		await db
			.insertInto("listing")
			.values({
				id,
				owner_id: userId,
				title: seed.title,
				make_id: make.id,
				model_id: null,
				year: seed.year,
				engine_cc: seed.engine_cc,
				required_license: seed.required_license,
				motorcycle_type: seed.motorcycle_type,
				price_per_day: seed.price_per_day * 100,
				price_per_week: seed.price_per_week ? seed.price_per_week * 100 : null,
				price_description: null,
				city: seed.city,
				region: seed.region,
				postal_code: null,
				description: seed.description,
				mileage_limit: null,
				status: seed.status,
				expires_at: expiresAt,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		if (seed.images.length > 0) {
			await db
				.insertInto("listing_image")
				.values(
					seed.images.map((url, i) => ({
						id: crypto.randomUUID(),
						listing_id: id,
						url,
						order: i,
					})),
				)
				.execute();
		}
	}

	console.log(`\n✅ Done. Login: ${SEED_EMAIL} / ${SEED_PASSWORD}\n`);
	await db.destroy();
}

main().catch(async (err) => {
	console.error("Seed failed:", err);
	await db.destroy();
	process.exit(1);
});
```

- [ ] **Step 2: Update e2e/global-setup.ts**

Find the listing insert block (around line 95–120). Before it, insert a Honda make and capture its ID, then use `make_id` in the listing insert:

```ts
// After any existing setup and before the listing insert:
// Insert Honda make for e2e listing
const e2eMake = await db
  .insertInto("motorcycle_make")
  .values({ id: crypto.randomUUID(), name: "Honda", slug: "honda-e2e", approved: true })
  .returningAll()
  .executeTakeFirstOrThrow();
```

Then in the listing `.values({...})` block, replace `deposit_amount: 20000` (already removed) and add:
```ts
make_id: e2eMake.id,
model_id: null,
```
Remove `available_from: null` and `available_to: null` (already removed in migration 006).

- [ ] **Step 3: Run seed to verify**

```bash
pnpm db:seed
```

Expected: "✅ Done. Login: dev@vuokramoto.local / devpassword"

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/seed.ts e2e/global-setup.ts
git commit -m "feat: seed motorcycle makes and models"
```

---

## Task 3: Server Functions + Unit Tests

**Files:**
- Create: `src/lib/makes.ts`
- Create: `src/lib/makes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/makes.test.ts
import { describe, expect, it } from "vitest";
import { toSlug } from "./makes";

describe("toSlug", () => {
	it("lowercases and replaces spaces with hyphens", () => {
		expect(toSlug("Moto Guzzi")).toBe("moto-guzzi");
	});
	it("preserves existing hyphens", () => {
		expect(toSlug("Harley-Davidson")).toBe("harley-davidson");
	});
	it("trims whitespace", () => {
		expect(toSlug("  Honda  ")).toBe("honda");
	});
	it("collapses multiple spaces to a single hyphen", () => {
		expect(toSlug("Royal  Enfield")).toBe("royal-enfield");
	});
	it("strips non-alphanumeric characters except hyphens", () => {
		expect(toSlug("Can/Am")).toBe("canam");
	});
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pnpm vitest run src/lib/makes.test.ts
```

Expected: FAIL — `Cannot find module './makes'`

- [ ] **Step 3: Create src/lib/makes.ts**

```ts
// src/lib/makes.ts
import { createServerFn } from "@tanstack/react-start";
import { db } from "~/lib/db/index";
import { getSession } from "~/lib/session";

export function toSlug(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

export const getMakes = createServerFn({ method: "GET" }).handler(() => {
	return db
		.selectFrom("motorcycle_make")
		.select(["id", "name", "slug"])
		.orderBy("name", "asc")
		.execute();
});

export const getModels = createServerFn({ method: "GET" })
	.inputValidator((makeId: string) => makeId)
	.handler(({ data: makeId }) => {
		return db
			.selectFrom("motorcycle_model")
			.select(["id", "name"])
			.where("make_id", "=", makeId)
			.orderBy("name", "asc")
			.execute();
	});

export const createMake = createServerFn({ method: "POST" })
	.inputValidator((name: string) => name)
	.handler(async ({ data: name }) => {
		const session = await getSession();
		if (!session) throw new Error("Kirjaudu sisään");
		return db
			.insertInto("motorcycle_make")
			.values({ id: crypto.randomUUID(), name: name.trim(), slug: toSlug(name), approved: true })
			.returningAll()
			.executeTakeFirstOrThrow();
	});

export const createModel = createServerFn({ method: "POST" })
	.inputValidator((data: { makeId: string; name: string }) => data)
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) throw new Error("Kirjaudu sisään");
		return db
			.insertInto("motorcycle_model")
			.values({ id: crypto.randomUUID(), make_id: data.makeId, name: data.name.trim(), approved: true })
			.returningAll()
			.executeTakeFirstOrThrow();
	});
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pnpm vitest run src/lib/makes.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/makes.ts src/lib/makes.test.ts
git commit -m "feat: makes/models server functions"
```

---

## Task 4: Validators + i18n

**Files:**
- Modify: `src/lib/validators.ts`
- Modify: `src/lib/i18n/resources/fi/listings.ts`

- [ ] **Step 1: Write failing validator tests**

```ts
// src/lib/validators.test.ts  (create this file)
import { describe, expect, it } from "vitest";
import { listingFormSchema } from "./validators";

describe("listingFormSchema", () => {
	it("requires make_id", () => {
		const result = listingFormSchema.safeParse({
			title: "Testi pyörä jolla on pitkä nimi",
			make_id: "",
			year: 2020,
			motorcycle_type: "naked",
			price_per_day: 50,
			city: "Helsinki",
			region: "uusimaa",
			description: "Tämä on kuvaus joka on tarpeeksi pitkä validointia varten",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes("make_id"))).toBe(true);
		}
	});

	it("accepts null model_id", () => {
		const result = listingFormSchema.safeParse({
			title: "Testi pyörä jolla on pitkä nimi",
			make_id: "some-uuid",
			model_id: null,
			year: 2020,
			motorcycle_type: "naked",
			price_per_day: 50,
			city: "Helsinki",
			region: "uusimaa",
			description: "Tämä on kuvaus joka on tarpeeksi pitkä validointia varten",
		});
		expect(result.success).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pnpm vitest run src/lib/validators.test.ts
```

Expected: FAIL — schema still has `brand`/`model`

- [ ] **Step 3: Update validators.ts**

Replace the `brand` and `model` lines with `make_id` and `model_id`. The full updated schema:

```ts
export const listingFormSchema = z.object({
	title: z
		.string()
		.min(5, "Otsikko on liian lyhyt (min 5 merkkiä)")
		.max(100, "Otsikko on liian pitkä"),
	make_id: z.string().min(1, "Valitse merkki"),
	model_id: z.string().nullable().optional(),
	year: z
		.number()
		.int()
		.min(1970, "Vuosimalli liian vanha")
		.max(CURRENT_YEAR + 1, "Vuosimalli ei voi olla tulevaisuudessa"),
	engine_cc: z.number().int().min(50).max(3000).nullable().optional(),
	motorcycle_type: z.string().min(1, "Valitse tyyppi"),
	required_license: z.enum(["A1", "A2", "A"]).nullable().optional(),
	price_per_day: z.number().min(1, "Päivähinta on pakollinen").max(10000),
	price_per_week: z.number().min(1).max(50000).nullable().optional(),
	price_description: z.string().max(200).nullable().optional(),
	city: z.string().min(1, "Kaupunki on pakollinen").max(100),
	region: z.string().min(1, "Valitse alue"),
	postal_code: z.string().max(10).nullable().optional(),
	description: z.string().min(20, "Kuvaus on liian lyhyt (min 20 merkkiä)").max(5000),
	mileage_limit: z.number().int().min(0).max(10000).nullable().optional(),
	image_urls: z.array(z.string()).max(8).default([]),
});
```

- [ ] **Step 4: Update i18n listings.ts**

In `form.fields`, remove `brand`, `brandPlaceholder`, `model` (replaced by MakeModelSelect's internal hardcoded labels). Keep `detail.specs.brand` and `detail.specs.model` — those are unaffected.

The updated `form.fields` block:
```ts
		fields: {
			title: "Otsikko",
			titleHint: "Kuvaava otsikko houkuttelee enemmän yhteydenottoja",
			type: "Tyyppi",
			typePlaceholder: "Valitse tyyppi",
			requiredLicense: "Vaadittu ajokortti",
			pricePerDay: "Päivähinta (€)",
			pricePerWeek: "Viikkohinta (€)",
			priceDescription: "Lisätietoja hinnasta",
			city: "Kaupunki",
			region: "Maakunta",
			regionPlaceholder: "Valitse maakunta",
			postalCode: "Postinumero",
			description: "Kuvaus",
			descriptionCharCount: "{{n}}/5000 merkkiä",
			mileageLimit: "Kilometriraja (km/pv)",
			mileageLimitHint: "Jätä tyhjäksi jos ei kilometrirajoitusta",
		},
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
pnpm vitest run src/lib/validators.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/validators.ts src/lib/validators.test.ts src/lib/i18n/resources/fi/listings.ts
git commit -m "feat: update listing validator and i18n for make_id/model_id"
```

---

## Task 5: MakeModelSelect Component

**Files:**
- Create: `src/components/listings/make-model-select.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/listings/make-model-select.tsx
import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createMake, createModel, getMakes, getModels } from "~/lib/makes";

interface Make {
	id: string;
	name: string;
	slug: string;
}
interface Model {
	id: string;
	name: string;
}

interface MakeModelSelectProps {
	initialMakeId?: string | null;
	initialModelId?: string | null;
	onMakeChange: (makeId: string) => void;
	onModelChange: (modelId: string | null) => void;
	makeError?: unknown;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: combobox with add-new flow
export function MakeModelSelect({
	initialMakeId,
	initialModelId,
	onMakeChange,
	onModelChange,
	makeError,
}: MakeModelSelectProps) {
	const [makes, setMakes] = useState<Make[]>([]);
	const [models, setModels] = useState<Model[]>([]);
	const [selectedMake, setSelectedMake] = useState<Make | null>(null);
	const [selectedModel, setSelectedModel] = useState<Model | null>(null);
	const [makeFilter, setMakeFilter] = useState("");
	const [modelFilter, setModelFilter] = useState("");
	const [makeOpen, setMakeOpen] = useState(false);
	const [modelOpen, setModelOpen] = useState(false);
	const [makeAddingNew, setMakeAddingNew] = useState(false);
	const [modelAddingNew, setModelAddingNew] = useState(false);
	const [newMakeName, setNewMakeName] = useState("");
	const [newModelName, setNewModelName] = useState("");
	const [makeLoading, setMakeLoading] = useState(false);
	const [modelLoading, setModelLoading] = useState(false);

	const makeRef = useRef<HTMLDivElement>(null);
	const modelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		getMakes().then((loadedMakes) => {
			setMakes(loadedMakes);
			if (!initialMakeId) return;
			const initialMake = loadedMakes.find((m) => m.id === initialMakeId);
			if (!initialMake) return;
			setSelectedMake(initialMake);
			onMakeChange(initialMake.id);
			getModels({ data: initialMakeId }).then((loadedModels) => {
				setModels(loadedModels);
				if (!initialModelId) return;
				const initialModel = loadedModels.find((m) => m.id === initialModelId);
				if (!initialModel) return;
				setSelectedModel(initialModel);
				onModelChange(initialModel.id);
			});
		});
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			if (makeRef.current && !makeRef.current.contains(e.target as Node)) {
				setMakeOpen(false);
				setMakeFilter("");
				setMakeAddingNew(false);
				setNewMakeName("");
			}
		}
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, []);

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
				setModelOpen(false);
				setModelFilter("");
				setModelAddingNew(false);
				setNewModelName("");
			}
		}
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, []);

	const filteredMakes = makes.filter((m) =>
		m.name.toLowerCase().includes(makeFilter.toLowerCase()),
	);
	const filteredModels = models.filter((m) =>
		m.name.toLowerCase().includes(modelFilter.toLowerCase()),
	);

	function handleMakeSelect(make: Make) {
		setSelectedMake(make);
		setMakeOpen(false);
		setMakeFilter("");
		setMakeAddingNew(false);
		setNewMakeName("");
		onMakeChange(make.id);
		setSelectedModel(null);
		setModels([]);
		setModelFilter("");
		onModelChange(null);
		getModels({ data: make.id }).then(setModels);
	}

	function handleModelSelect(model: Model) {
		setSelectedModel(model);
		setModelOpen(false);
		setModelFilter("");
		setModelAddingNew(false);
		setNewModelName("");
		onModelChange(model.id);
	}

	async function handleAddMake() {
		if (!newMakeName.trim()) return;
		setMakeLoading(true);
		try {
			const newMake = await createMake({ data: newMakeName.trim() });
			setMakes((prev) => [...prev, newMake].sort((a, b) => a.name.localeCompare(b.name)));
			handleMakeSelect(newMake);
		} finally {
			setMakeLoading(false);
		}
	}

	async function handleAddModel() {
		if (!selectedMake || !newModelName.trim()) return;
		setModelLoading(true);
		try {
			const newModel = await createModel({
				data: { makeId: selectedMake.id, name: newModelName.trim() },
			});
			setModels((prev) => [...prev, newModel].sort((a, b) => a.name.localeCompare(b.name)));
			handleModelSelect(newModel);
		} finally {
			setModelLoading(false);
		}
	}

	const triggerClass =
		"flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

	const dropdownClass =
		"absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-card shadow-lg";

	const filterInputClass =
		"w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-accent";

	const addInputClass =
		"flex-1 rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-accent";

	return (
		<div className="grid grid-cols-2 gap-4">
			{/* ── Make ────────────────────────────────────────────────────────── */}
			<div ref={makeRef} className="relative">
				<label className="mb-1 block text-sm font-medium text-foreground">
					Merkki <span className="text-destructive">*</span>
				</label>
				<button
					type="button"
					onClick={() => {
						setMakeOpen((prev) => !prev);
						setMakeFilter("");
					}}
					className={triggerClass}
				>
					<span className={selectedMake ? "text-foreground" : "text-muted"}>
						{selectedMake?.name ?? "Valitse merkki"}
					</span>
					<ChevronDown className="h-4 w-4 shrink-0 text-muted" />
				</button>

				{makeOpen && (
					<div className={dropdownClass}>
						<div className="p-2">
							<input
								type="text"
								// biome-ignore lint/a11y/noAutofocus: intentional — focus filter on dropdown open
								autoFocus
								value={makeFilter}
								onChange={(e) => setMakeFilter(e.target.value)}
								placeholder="Hae..."
								className={filterInputClass}
							/>
						</div>
						<ul className="max-h-52 overflow-y-auto">
							{filteredMakes.map((make) => (
								<li key={make.id}>
									<button
										type="button"
										onClick={() => handleMakeSelect(make)}
										className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted-light"
									>
										{make.name}
									</button>
								</li>
							))}
							{filteredMakes.length === 0 && (
								<li className="px-3 py-2 text-sm text-muted">Ei tuloksia</li>
							)}
						</ul>
						<div className="border-t border-border p-2">
							{makeAddingNew ? (
								<div className="flex items-center gap-2">
									<input
										type="text"
										// biome-ignore lint/a11y/noAutofocus: intentional — focus add input
										autoFocus
										value={newMakeName}
										onChange={(e) => setNewMakeName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddMake();
											}
										}}
										placeholder="Merkin nimi..."
										className={addInputClass}
									/>
									<button
										type="button"
										onClick={handleAddMake}
										disabled={makeLoading || !newMakeName.trim()}
										className="rounded bg-accent px-3 py-1 text-sm text-white disabled:opacity-50"
									>
										Lisää
									</button>
									<button
										type="button"
										onClick={() => {
											setMakeAddingNew(false);
											setNewMakeName("");
										}}
										className="text-sm text-muted hover:text-foreground"
									>
										Peruuta
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setMakeAddingNew(true)}
									className="flex items-center gap-1 text-sm text-accent hover:underline"
								>
									<Plus className="h-3 w-3" />
									Ei löydy listalta — lisää uusi
								</button>
							)}
						</div>
					</div>
				)}

				{makeError != null && (
					<p className="mt-1 text-sm text-destructive">
						{typeof makeError === "string" ? makeError : String(makeError)}
					</p>
				)}
			</div>

			{/* ── Model ───────────────────────────────────────────────────────── */}
			<div ref={modelRef} className="relative">
				<label
					className={`mb-1 block text-sm font-medium ${selectedMake ? "text-foreground" : "text-muted"}`}
				>
					Malli
				</label>
				<button
					type="button"
					disabled={!selectedMake}
					onClick={() => {
						setModelOpen((prev) => !prev);
						setModelFilter("");
					}}
					className={`${triggerClass} disabled:cursor-not-allowed disabled:opacity-50`}
				>
					<span className={selectedModel ? "text-foreground" : "text-muted"}>
						{selectedModel?.name ??
							(selectedMake ? "Valitse malli (vapaaehtoinen)" : "Valitse ensin merkki")}
					</span>
					<ChevronDown className="h-4 w-4 shrink-0 text-muted" />
				</button>

				{modelOpen && (
					<div className={dropdownClass}>
						<div className="p-2">
							<input
								type="text"
								// biome-ignore lint/a11y/noAutofocus: intentional
								autoFocus
								value={modelFilter}
								onChange={(e) => setModelFilter(e.target.value)}
								placeholder="Hae..."
								className={filterInputClass}
							/>
						</div>
						<ul className="max-h-52 overflow-y-auto">
							{selectedModel && (
								<li>
									<button
										type="button"
										onClick={() => {
											setSelectedModel(null);
											onModelChange(null);
											setModelOpen(false);
										}}
										className="w-full px-3 py-2 text-left text-sm text-muted hover:bg-muted-light"
									>
										(tyhjennä valinta)
									</button>
								</li>
							)}
							{filteredModels.map((model) => (
								<li key={model.id}>
									<button
										type="button"
										onClick={() => handleModelSelect(model)}
										className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted-light"
									>
										{model.name}
									</button>
								</li>
							))}
							{filteredModels.length === 0 && (
								<li className="px-3 py-2 text-sm text-muted">Ei malleja — lisää uusi</li>
							)}
						</ul>
						<div className="border-t border-border p-2">
							{modelAddingNew ? (
								<div className="flex items-center gap-2">
									<input
										type="text"
										// biome-ignore lint/a11y/noAutofocus: intentional
										autoFocus
										value={newModelName}
										onChange={(e) => setNewModelName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddModel();
											}
										}}
										placeholder="Mallin nimi..."
										className={addInputClass}
									/>
									<button
										type="button"
										onClick={handleAddModel}
										disabled={modelLoading || !newModelName.trim()}
										className="rounded bg-accent px-3 py-1 text-sm text-white disabled:opacity-50"
									>
										Lisää
									</button>
									<button
										type="button"
										onClick={() => {
											setModelAddingNew(false);
											setNewModelName("");
										}}
										className="text-sm text-muted hover:text-foreground"
									>
										Peruuta
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setModelAddingNew(true)}
									className="flex items-center gap-1 text-sm text-accent hover:underline"
								>
									<Plus className="h-3 w-3" />
									Ei löydy listalta — lisää uusi
								</button>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/listings/make-model-select.tsx
git commit -m "feat: MakeModelSelect combobox component"
```

---

## Task 6: Form Integration

**Files:**
- Modify: `src/components/listings/listing-form.tsx`
- Modify: `src/routes/ilmoitukset/uusi.tsx`
- Modify: `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`

- [ ] **Step 1: Update listing-form.tsx**

Add import at top of file (after existing imports):
```ts
import { MakeModelSelect } from "~/components/listings/make-model-select";
```

In `defaultValues`, replace the brand/model entries:
```ts
// Remove:
//   brand: initialValues?.brand ?? "",
//   model: initialValues?.model ?? "",
// Add:
make_id: initialValues?.make_id ?? "",
model_id: initialValues?.model_id ?? null,
```

In the Moottoripyörä section, replace the `<div className="grid grid-cols-2 gap-4">` block that contains the brand Select and the model Input field with:

```tsx
<form.Field name="make_id">
  {(makeField) => (
    <MakeModelSelect
      initialMakeId={initialValues?.make_id ?? null}
      initialModelId={initialValues?.model_id ?? null}
      onMakeChange={(id) => makeField.handleChange(id)}
      onModelChange={(id) => form.setFieldValue("model_id", id)}
      makeError={makeField.state.meta.errors[0]}
    />
  )}
</form.Field>
```

Remove the entire `<form.Field name="brand">` block and the `<form.Field name="model">` block (they were in a `grid grid-cols-2` div — remove the div and both fields).

Also remove the `MOTORCYCLE_BRANDS` import since it's no longer used.

- [ ] **Step 2: Update uusi.tsx insert**

In the `createListing` handler, replace:
```ts
// Remove:
//   brand: data.brand,
//   model: data.model,
// Add:
make_id: data.make_id,
model_id: data.model_id ?? null,
```

- [ ] **Step 3: Update $listingId_.muokkaa.tsx**

In `initialValues`, replace:
```ts
// Remove:
//   brand: listing.brand,
//   model: listing.model,
// Add:
make_id: listing.make_id,
model_id: listing.model_id ?? null,
```

In `updateListing` handler's `.set({...})`, replace:
```ts
// Remove:
//   brand: form.brand,
//   model: form.model,
// Add:
make_id: form.make_id,
model_id: form.model_id ?? null,
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If `MOTORCYCLE_BRANDS` removal causes issues, ensure the import is removed from listing-form.tsx.

- [ ] **Step 5: Commit**

```bash
git add src/components/listings/listing-form.tsx src/routes/ilmoitukset/uusi.tsx src/routes/ilmoitukset/$listingId_.muokkaa.tsx
git commit -m "feat: wire MakeModelSelect into listing form, create, and edit"
```

---

## Task 7: Listing Detail Page

**Files:**
- Modify: `src/routes/ilmoitukset/$listingId.tsx`

- [ ] **Step 1: Update getListing to fetch make/model names**

After the `listing` query and before the images query, add:

```ts
const [make, model] = await Promise.all([
  listing.make_id
    ? db
        .selectFrom("motorcycle_make")
        .select("name")
        .where("id", "=", listing.make_id)
        .executeTakeFirst()
    : Promise.resolve(null),
  listing.model_id
    ? db
        .selectFrom("motorcycle_model")
        .select("name")
        .where("id", "=", listing.model_id)
        .executeTakeFirst()
    : Promise.resolve(null),
]);
```

Update the return value:
```ts
return { listing, images, owner, ownerEmail, makeName: make?.name ?? null, modelName: model?.name ?? null };
```

- [ ] **Step 2: Update ListingSpecs**

Change the function signature:
```ts
function ListingSpecs({
  listing,
  makeName,
  modelName,
}: {
  listing: Listing;
  makeName: string | null;
  modelName: string | null;
}) {
```

Replace `listing.brand` and `listing.model` in the JSX:
```tsx
// Was: <dd className="font-medium text-foreground">{listing.brand}</dd>
<dd className="font-medium text-foreground">{makeName ?? "—"}</dd>

// Was: <dd className="font-medium text-foreground">{listing.model}</dd>
<dd className="font-medium text-foreground">{modelName ?? "—"}</dd>
```

- [ ] **Step 3: Pass makeName/modelName to ListingSpecs**

In `ListingDetailPage`, destructure from loader data and pass to component:
```tsx
const { listing, images, owner, ownerEmail, session, isOwner, makeName, modelName } =
  Route.useLoaderData();
// ...
<ListingSpecs listing={listing} makeName={makeName} modelName={modelName} />
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/ilmoitukset/$listingId.tsx
git commit -m "feat: show make/model names on listing detail page"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: no errors. Fix any warnings about unused imports (e.g. `MOTORCYCLE_BRANDS` if not removed).

- [ ] **Step 3: Unit tests**

```bash
pnpm test
```

Expected: all tests pass (includes toSlug and validator tests).

- [ ] **Step 4: Run seed**

```bash
pnpm db:seed
```

Expected: "✅ Done." with no errors.

- [ ] **Step 5: Start dev server and manually verify**

```bash
pnpm dev
```

Open http://localhost:3000/ilmoitukset/uusi. Verify:
- Merkki combobox loads makes, filters on type, allows adding a new make
- Selecting a make loads the Malli combobox
- Malli filters, allows adding a new model, can be left blank
- Submitting creates a listing (redirects to detail page)
- Detail page shows make name and model name (or "—") in the specs block
- Open an existing listing and click Muokkaa — make/model pre-populate correctly
