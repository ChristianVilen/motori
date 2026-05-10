# Marketplace Phase 2 + Brand Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four category-scoped browse/detail routes (sale, rental, gear, parts), a multi-category create/edit form, 301 redirects for legacy URLs, an updated sitemap, and a community-first homepage rebrand.

**Architecture:** Four route namespaces (`/pyorat/myynti`, `/pyorat/vuokraus`, `/varusteet`, `/varaosat`) each own a browse index and detail page. A shared `<BrowsePage>` component and `<ListingDetailShell>` avoid duplication. The query layer gains a `category` parameter. Legacy `/ilmoitukset/$id` and `/tori/$id` routes do a single DB lookup and issue a 301 to the correct category URL. The create form is refactored to a discriminated-union schema with a category tile selector.

**Tech stack:** TanStack Start (file-based routing, `createFileRoute`, `createServerFn`), Kysely (query builder), `@tanstack/react-form`, Zod discriminated union, Biome, pnpm, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-05-09-marketplace-phase2-design.md`

**Pre-flight:**
- `humanizer` skill available at `/home/cride/.agents/skills/humanizer/SKILL.md` — use it on all Finnish/English copy in Task 11
- `frontend-design` skill — use it when building new homepage visual sections in Task 11

**Verification shorthand (run after every task):**
```bash
pnpm typecheck
```
Full suite at the end only:
```bash
pnpm lint:fix && pnpm format:fix && pnpm typecheck && pnpm test:e2e
```

---

## File map

| Action | Path | Purpose |
|---|---|---|
| Modify | `src/lib/validators.ts` | Add `CONDITIONS`, `GEAR_TYPES`; replace flat `listingFormSchema` with discriminated union |
| Modify | `src/lib/listings-commands.ts` | `createListing` / `updateListing` handle all 4 categories |
| Modify | `src/lib/listings-queries.ts` | `searchListings` + `category` param; `getLatestListings` + category; extend `getListingForDisplay` / `getListingForEdit` |
| Create | `src/components/nav/category-dropdown.tsx` | Pyörät hover dropdown |
| Modify | `src/routes/__root.tsx` | Swap nav links; update root `<head>` meta |
| Create | `src/components/listings/browse-page.tsx` | Route-agnostic browse component |
| Create | `src/routes/pyorat/myynti/index.tsx` | Sale browse |
| Create | `src/routes/pyorat/vuokraus/index.tsx` | Rental browse |
| Create | `src/routes/varusteet/index.tsx` | Gear browse |
| Create | `src/routes/varaosat/index.tsx` | Parts browse |
| Modify | `src/routes/ilmoitukset/index.tsx` | Client redirect → `/pyorat/vuokraus` |
| Modify | `src/routes/tori/index.tsx` | Client redirect → `/varusteet` |
| Modify | `src/routes/ilmoitukset/$listingId_.$slug.tsx` | 301 redirect by listing category |
| Modify | `src/routes/tori/$itemId_.$slug.tsx` | 301 redirect by listing category |
| Create | `src/components/listings/listing-detail-shell.tsx` | Shared gallery/title/desc/location shell |
| Create | `src/components/listings/sale-detail-sidebar.tsx` | Price + contact for sale listings |
| Create | `src/components/listings/gear-detail-sidebar.tsx` | Price + contact for gear |
| Create | `src/components/listings/part-detail-sidebar.tsx` | Price + contact for parts |
| Create | `src/routes/pyorat/vuokraus/$listingId_.$slug.tsx` | Rental detail (booking form) |
| Create | `src/routes/pyorat/myynti/$listingId_.$slug.tsx` | Sale detail |
| Create | `src/routes/varusteet/$listingId_.$slug.tsx` | Gear detail |
| Create | `src/routes/varaosat/$listingId_.$slug.tsx` | Parts detail |
| Modify | `src/components/listings/listing-form.tsx` | Category tile selector + conditional field sections |
| Modify | `src/routes/ilmoitukset/uusi.tsx` | Pass category to form; redirect to correct route post-create |
| Modify | `src/routes/ilmoitukset/$listingId_.muokkaa.tsx` | Lock category; redirect to correct route post-edit |
| Modify | `src/routes/sitemap[.]xml.ts` | Category-aware URLs; remove duplicate tori query |
| Modify | `src/routes/index.tsx` | Homepage rebrand |
| Modify | `src/lib/i18n/resources/fi/home.ts` | Community-first Finnish copy |
| Modify | `src/lib/i18n/resources/en/home.ts` | Community-first English copy |
| Modify | `src/lib/i18n/resources/fi/common.ts` | Nav keys: bikes/sale/rental/gear/parts |
| Modify | `src/lib/i18n/resources/en/common.ts` | Same |
| Modify | `src/lib/i18n/resources/fi/listings.ts` | Form category keys |
| Modify | `src/lib/i18n/resources/en/listings.ts` | Same |
| Modify | `e2e/tests/` (multiple) | Update `/ilmoitukset` and `/tori` references |
| Create | `e2e/tests/redirects.spec.ts` | Redirect smoke tests |
| Create | `e2e/tests/categories.spec.ts` | Browse/detail smoke tests |

---

## Task 1: Extend validators — discriminated union schema

**Files:**
- Modify: `src/lib/validators.ts`

The current `listingFormSchema` is a flat rental-only object. Replace it with a `z.discriminatedUnion` on `category`. Also add `CONDITIONS`, `GEAR_TYPES`, and a `condition` filter to `browseSearchSchema`.

- [ ] **Step 1: Add constants and extend `browseSearchSchema`**

Open `src/lib/validators.ts`. After the existing imports, add:

```ts
export const CONDITIONS = ["new", "excellent", "good", "fair", "poor"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const GEAR_TYPES = ["helmet", "jacket", "pants", "boots", "gloves", "other"] as const;
export type GearTypeValue = (typeof GEAR_TYPES)[number];
```

Then extend `browseSearchSchema` to include `gear_type` and `condition` (used by gear/parts browse filters). Replace the existing `browseSearchSchema` definition:

```ts
export const browseSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  region: z.string().trim().max(100).optional(),
  type: z.array(z.enum(MOTORCYCLE_TYPES.map((t) => t.value) as [string, ...string[]])).optional(),
  license: z.array(z.enum(LICENSE_CLASSES.map((l) => l.value) as [string, ...string[]])).optional(),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  cc_min: z.number().int().min(1).optional(),
  cc_max: z.number().int().min(1).optional(),
  year_min: z.number().int().min(1970).optional(),
  year_max: z.number().int().min(1970).max(CURRENT_YEAR + 1).optional(),
  make: z.string().trim().max(100).optional(),
  gear_type: z.enum(GEAR_TYPES).optional(),
  condition: z.enum(CONDITIONS).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "relevance"]).optional(),
  cursor: z.string().max(200).optional(),
  view: z.enum(["list", "map"]).optional(),
  city: z.string().trim().max(100).optional(),
});
export type BrowseSearchParams = z.infer<typeof browseSearchSchema>;
```

Update `countActiveFilters` to count the two new fields:

```ts
export function countActiveFilters(search: BrowseSearchParams): number {
  return (
    (search.region ? 1 : 0) +
    (search.type?.length ?? 0) +
    (search.license?.length ?? 0) +
    (search.price_min != null ? 1 : 0) +
    (search.price_max != null ? 1 : 0) +
    (search.cc_min != null ? 1 : 0) +
    (search.cc_max != null ? 1 : 0) +
    (search.year_min != null ? 1 : 0) +
    (search.year_max != null ? 1 : 0) +
    (search.make ? 1 : 0) +
    (search.gear_type ? 1 : 0) +
    (search.condition ? 1 : 0)
  );
}
```

- [ ] **Step 2: Replace `listingFormSchema` with a discriminated union**

Delete the existing `listingFormSchema` function and `ListingFormData` type. Replace with:

```ts
function sharedFields(t: T) {
  return {
    title: z
      .string()
      .trim()
      .min(5, t("validation.titleTooShort"))
      .max(100, t("validation.titleTooLong")),
    city: z
      .string()
      .trim()
      .min(1, t("validation.cityRequired"))
      .refine((v) => MUNICIPALITY_NAME_SET.has(v), t("validation.cityInvalid")),
    region: z.string().trim().min(1, t("validation.regionRequired")),
    postal_code: z.string().trim().max(10).nullable().optional(),
    description: z
      .string()
      .trim()
      .min(20, t("validation.descriptionTooShort"))
      .max(5000),
    images: z.array(listingImageSchema(t)).max(8).default([]),
  };
}

const CONDITION_ENUM = CONDITIONS;

export function listingFormSchema(t: T = defaultT) {
  const shared = sharedFields(t);
  return z.discriminatedUnion("category", [
    z.object({
      ...shared,
      category: z.literal("rental"),
      make_id: z.string().min(1, t("validation.brandRequired")),
      model_id: z.string().nullable().optional(),
      year: z
        .number()
        .int()
        .min(1970, t("validation.yearTooOld"))
        .max(CURRENT_YEAR + 1, t("validation.yearInFuture")),
      engine_cc: z.number().int().min(50).max(3000).nullable().optional(),
      motorcycle_type: z.string().trim().min(1, t("validation.typeRequired")),
      required_license: z.enum(["A1", "A2", "A"]).nullable().optional(),
      price_per_day: z.number().min(1, t("validation.pricePerDayRequired")).max(10000),
      price_per_week: z.number().min(1).max(50000).nullable().optional(),
      price_per_weekend: z.number().min(1).max(50000).nullable().optional(),
      price_description: z.string().trim().max(200).nullable().optional(),
      mileage_limit: z.number().int().min(0).max(10000).nullable().optional(),
    }),
    z.object({
      ...shared,
      category: z.literal("sale"),
      make_id: z.string().min(1, t("validation.brandRequired")),
      model_id: z.string().nullable().optional(),
      year: z
        .number()
        .int()
        .min(1970, t("validation.yearTooOld"))
        .max(CURRENT_YEAR + 1, t("validation.yearInFuture")),
      engine_cc: z.number().int().min(50).max(3000).nullable().optional(),
      motorcycle_type: z.string().trim().min(1, t("validation.typeRequired")),
      required_license: z.enum(["A1", "A2", "A"]).nullable().optional(),
      condition: z.enum(CONDITION_ENUM),
      km_driven: z.number().int().min(0).max(999999).nullable().optional(),
      price: z.number().int().min(1).max(100_000_000),
      negotiable: z.boolean().default(false),
    }),
    z.object({
      ...shared,
      category: z.literal("gear"),
      gear_type: z.enum(GEAR_TYPES),
      size: z.string().trim().max(20).nullable().optional(),
      condition: z.enum(CONDITION_ENUM),
      price: z.number().int().min(1).max(10_000_000),
    }),
    z.object({
      ...shared,
      category: z.literal("part"),
      part_category: z.string().trim().min(1).max(100),
      compatible_make_id: z.string().nullable().optional(),
      condition: z.enum(CONDITION_ENUM),
      price: z.number().int().min(1).max(10_000_000),
    }),
  ]);
}

export type ListingFormData = z.infer<ReturnType<typeof listingFormSchema>>;
export type RentalFormData = Extract<ListingFormData, { category: "rental" }>;
export type SaleFormData = Extract<ListingFormData, { category: "sale" }>;
export type GearFormData = Extract<ListingFormData, { category: "gear" }>;
export type PartFormData = Extract<ListingFormData, { category: "part" }>;
```

- [ ] **Step 3: Run typecheck — expect errors in downstream files**

```bash
pnpm typecheck
```

Expected: errors in `listings-commands.ts`, `listings-queries.ts`, `listing-form.tsx`, route files. These are fixed in subsequent tasks. Note them — do not fix yet.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validators.ts
git commit -m "feat: discriminated union listingFormSchema for sale/rental/gear/part"
```

---

## Task 2: Update listings-commands — all four categories

**Files:**
- Modify: `src/lib/listings-commands.ts`

- [ ] **Step 1: Rewrite `createListing`**

Replace the entire function body. The `hasBike` flag guards make/model/year/CC/type/license which only apply to sale and rental:

```ts
import { eurosToCents } from "~/lib/currency";
import { AppError } from "~/lib/errors";
import { generateShortId } from "~/lib/slug";
import type { GearType } from "~/lib/db/schema";
import type { ListingFormData } from "~/lib/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

export type CreateListingResult = {
  id: string;
  shortId: string;
  category: string;
  makeSlug: string | null;
  modelName: string | null;
  city: string;
};

export async function createListing(
  ownerId: string,
  data: ListingFormData,
): Promise<CreateListingResult> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const shortId = generateShortId();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const hasBike = data.category === "sale" || data.category === "rental";

  await db
    .insertInto("listing")
    .values({
      id,
      short_id: shortId,
      owner_id: ownerId,
      category: data.category,
      title: data.title,
      make_id: hasBike ? data.make_id : null,
      model_id: hasBike ? (data.model_id ?? null) : null,
      year: hasBike ? data.year : null,
      engine_cc: hasBike ? (data.engine_cc ?? null) : null,
      required_license: hasBike ? (data.required_license ?? null) : null,
      motorcycle_type: hasBike ? data.motorcycle_type : null,
      city: data.city,
      region: data.region,
      postal_code: data.postal_code ?? null,
      description: data.description,
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  if (data.category === "rental") {
    await db
      .insertInto("listing_rental")
      .values({
        listing_id: id,
        price_per_day: eurosToCents(data.price_per_day),
        price_per_week: data.price_per_week ? eurosToCents(data.price_per_week) : null,
        price_per_weekend: data.price_per_weekend
          ? eurosToCents(data.price_per_weekend)
          : null,
        price_description: data.price_description ?? null,
        mileage_limit: data.mileage_limit ?? null,
      })
      .execute();
  } else if (data.category === "sale") {
    await db
      .insertInto("listing_sale")
      .values({
        listing_id: id,
        price: data.price,
        condition: data.condition,
        km_driven: data.km_driven ?? null,
        negotiable: data.negotiable,
      })
      .execute();
  } else if (data.category === "gear") {
    await db
      .insertInto("listing_gear")
      .values({
        listing_id: id,
        gear_type: data.gear_type as GearType,
        size: data.size ?? null,
        condition: data.condition,
        price: data.price,
      })
      .execute();
  } else {
    await db
      .insertInto("listing_part")
      .values({
        listing_id: id,
        part_category: data.part_category,
        compatible_make_id: data.compatible_make_id ?? null,
        compatible_model_id: null,
        condition: data.condition,
        price: data.price,
      })
      .execute();
  }

  if (data.images.length > 0) {
    await db
      .insertInto("listing_image")
      .values(
        data.images.map((img, i) => ({
          id: crypto.randomUUID(),
          listing_id: id,
          url: img.url,
          thumbnail_url: img.thumbnail_url ?? null,
          order: i,
        })),
      )
      .execute();
  }

  const [make, model] = await Promise.all([
    hasBike
      ? db
          .selectFrom("motorcycle_make")
          .select(["slug"])
          .where("id", "=", data.make_id)
          .executeTakeFirst()
      : Promise.resolve(null),
    hasBike && data.model_id
      ? db
          .selectFrom("motorcycle_model")
          .select(["name"])
          .where("id", "=", data.model_id)
          .executeTakeFirst()
      : Promise.resolve(null),
  ]);

  return {
    id,
    shortId,
    category: data.category,
    makeSlug: make?.slug ?? null,
    modelName: model?.name ?? null,
    city: data.city,
  };
}
```

- [ ] **Step 2: Rewrite `updateListing`**

```ts
export async function updateListing(
  id: string,
  ownerId: string,
  data: ListingFormData,
): Promise<void> {
  const db = await getDb();
  const existing = await db
    .selectFrom("listing")
    .select(["owner_id", "category"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!existing) throw new AppError("listing.not_found");
  if (existing.owner_id !== ownerId) throw new AppError("listing.forbidden");
  if (existing.category !== data.category) throw new AppError("listing.forbidden");

  const hasBike = data.category === "sale" || data.category === "rental";

  await db.transaction().execute(async (trx) => {
    const result = await trx
      .updateTable("listing")
      .set({
        title: data.title,
        make_id: hasBike ? data.make_id : null,
        model_id: hasBike ? (data.model_id ?? null) : null,
        year: hasBike ? data.year : null,
        engine_cc: hasBike ? (data.engine_cc ?? null) : null,
        required_license: hasBike ? (data.required_license ?? null) : null,
        motorcycle_type: hasBike ? data.motorcycle_type : null,
        city: data.city,
        region: data.region,
        postal_code: data.postal_code ?? null,
        description: data.description,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .where("owner_id", "=", ownerId)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) throw new AppError("listing.forbidden");

    if (data.category === "rental") {
      await trx
        .updateTable("listing_rental")
        .set({
          price_per_day: eurosToCents(data.price_per_day),
          price_per_week: data.price_per_week ? eurosToCents(data.price_per_week) : null,
          price_per_weekend: data.price_per_weekend
            ? eurosToCents(data.price_per_weekend)
            : null,
          price_description: data.price_description ?? null,
          mileage_limit: data.mileage_limit ?? null,
        })
        .where("listing_id", "=", id)
        .execute();
    } else if (data.category === "sale") {
      await trx
        .updateTable("listing_sale")
        .set({
          price: data.price,
          condition: data.condition,
          km_driven: data.km_driven ?? null,
          negotiable: data.negotiable,
        })
        .where("listing_id", "=", id)
        .execute();
    } else if (data.category === "gear") {
      await trx
        .updateTable("listing_gear")
        .set({
          gear_type: data.gear_type as GearType,
          size: data.size ?? null,
          condition: data.condition,
          price: data.price,
        })
        .where("listing_id", "=", id)
        .execute();
    } else {
      await trx
        .updateTable("listing_part")
        .set({
          part_category: data.part_category,
          compatible_make_id: data.compatible_make_id ?? null,
          condition: data.condition,
          price: data.price,
        })
        .where("listing_id", "=", id)
        .execute();
    }

    await trx.deleteFrom("listing_image").where("listing_id", "=", id).execute();

    if (data.images.length > 0) {
      await trx
        .insertInto("listing_image")
        .values(
          data.images.map((img, i) => ({
            id: crypto.randomUUID(),
            listing_id: id,
            url: img.url,
            thumbnail_url: img.thumbnail_url ?? null,
            order: i,
          })),
        )
        .execute();
    }
  });
}
```

Keep `setListingStatus` unchanged.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/listings-commands.ts
git commit -m "feat: createListing/updateListing support sale/gear/part categories"
```

---

## Task 3: Extend listings-queries — category param + child table fetches

**Files:**
- Modify: `src/lib/listings-queries.ts`

- [ ] **Step 1: Change `searchListings` to accept a `category` param**

The current server fn input is `BrowseSearchParams`. Change it to `BrowseSearchParams & { category: ListingCategory }` and split into two internal paths — `rental` uses the existing `listing_rental` join; `sale/gear/part` join their child table for price.

Replace the `searchListings` export and add a `searchSimpleListings` helper. Keep all existing private helpers (`applyCursor`, `applySort`, `applyFilters`, `hydrateListings`, etc.) unchanged — they only run for rental.

```ts
import type { ListingCategory } from "~/lib/db/schema";

export const searchListings = createServerFn({ method: "GET" })
  .middleware([rateLimitMiddleware(60, 60, "search")])
  .inputValidator((input: BrowseSearchParams & { category: ListingCategory }) => input)
  .handler(async ({ data: params }): Promise<SearchResult> => {
    if (params.category === "rental") {
      return searchRentalListings(params);
    }
    return searchSimpleListings(params);
  });

async function searchRentalListings(params: BrowseSearchParams): Promise<SearchResult> {
  const db = await getDb();
  const searchMode = await resolveListingSearchMode(params.q);
  const sort: SortMode = params.sort ?? (searchMode.type !== "none" ? "relevance" : "newest");

  const baseQuery = applyFilters(
    db
      .selectFrom("listing")
      .innerJoin("listing_rental", "listing_rental.listing_id", "listing.id")
      .where("listing.category", "=", "rental"),
    params,
    searchMode,
  );

  const countResult = await baseQuery
    .select(sql<number>`count(*)::int`.as("count"))
    .executeTakeFirstOrThrow();

  let query = baseQuery.selectAll("listing").select("listing_rental.price_per_day");
  if (params.cursor) query = applyCursor(query, params.cursor, sort);
  query = applySort(query, sort, searchMode);
  query = query.limit(PAGE_SIZE);

  const listings = await query.execute();
  return {
    listings: await hydrateListings(listings),
    nextCursor: buildNextCursor(listings, sort),
    totalCount: countResult.count,
  };
}

async function searchSimpleListings(
  params: BrowseSearchParams & { category: "sale" | "gear" | "part" },
): Promise<SearchResult> {
  const db = await getDb();
  const searchMode = await resolveListingSearchMode(params.q);
  const sort: SortMode = params.sort ?? (searchMode.type !== "none" ? "relevance" : "newest");

  const childTable =
    params.category === "sale"
      ? "listing_sale"
      : params.category === "gear"
        ? "listing_gear"
        : "listing_part";

  let base = db
    .selectFrom("listing")
    // biome-ignore lint/suspicious/noExplicitAny: dynamic join table name
    .innerJoin(`${childTable} as child` as any, "child.listing_id" as any, "listing.id")
    .where("listing.category", "=", params.category)
    .where("listing.status", "=", "active");

  if (searchMode.type === "fts") {
    base = base.where(
      sql<SqlBool>`listing.search_vector @@ to_tsquery('finnish_unaccent', ${searchMode.prefixQuery})`,
    );
  } else if (searchMode.type === "trigram") {
    base = base.where(
      sql<SqlBool>`(listing.title || ' ' || listing.description) % ${searchMode.raw}`,
    );
  }
  if (params.region) base = base.where("listing.region", "=", params.region);
  if (params.price_min != null)
    base = base.where(sql`child.price` as any, ">=", eurosToCents(params.price_min));
  if (params.price_max != null)
    base = base.where(sql`child.price` as any, "<=", eurosToCents(params.price_max));
  if (params.condition)
    base = base.where(sql`child.condition` as any, "=", params.condition);
  if (params.gear_type && params.category === "gear")
    base = base.where(sql`child.gear_type` as any, "=", params.gear_type);
  if (params.make && (params.category === "sale" || params.category === "part")) {
    base = base
      .innerJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
      .where("motorcycle_make.slug", "=", params.make);
  }

  const countResult = await (base as any)
    .select(sql<number>`count(*)::int`.as("count"))
    .executeTakeFirstOrThrow();

  let query = (base as any)
    .selectAll("listing")
    .select(sql<number>`child.price`.as("price_per_day")); // alias for cursor compat

  if (params.cursor) {
    const [cursorVal, cursorId] = params.cursor.split("__");
    if (cursorVal && cursorId) {
      if (sort === "price_asc") {
        query = query.where((eb: any) =>
          eb.or([
            eb(sql`child.price`, ">", Number(cursorVal)),
            eb.and([eb(sql`child.price`, "=", Number(cursorVal)), eb("listing.id", ">", cursorId)]),
          ]),
        );
      } else if (sort === "price_desc") {
        query = query.where((eb: any) =>
          eb.or([
            eb(sql`child.price`, "<", Number(cursorVal)),
            eb.and([eb(sql`child.price`, "=", Number(cursorVal)), eb("listing.id", "<", cursorId)]),
          ]),
        );
      } else {
        query = query.where((eb: any) =>
          eb.or([
            eb("listing.created_at", "<", new Date(cursorVal)),
            eb.and([
              eb("listing.created_at", "=", new Date(cursorVal)),
              eb("listing.id", "<", cursorId),
            ]),
          ]),
        );
      }
    }
  }

  if (sort === "price_asc") {
    query = query.orderBy(sql`child.price`, "asc").orderBy("listing.id", "asc");
  } else if (sort === "price_desc") {
    query = query.orderBy(sql`child.price`, "desc").orderBy("listing.id", "desc");
  } else {
    query = query.orderBy("listing.created_at", "desc").orderBy("listing.id", "desc");
  }
  query = query.limit(PAGE_SIZE);

  const listings = await query.execute();
  return {
    listings: await hydrateListings(listings),
    nextCursor: buildNextCursor(listings, sort),
    totalCount: countResult.count,
  };
}
```

- [ ] **Step 2: Update `getLatestListings` to accept a category**

```ts
export const getLatestListings = createServerFn({ method: "GET" })
  .inputValidator((category: ListingCategory) => category)
  .handler(async ({ data: category }) => {
    const db = await getDb();
    const listings = await db
      .selectFrom("listing")
      .selectAll()
      .where("status", "=", "active")
      .where("category", "=", category)
      .orderBy("created_at", "desc")
      .limit(6)
      .execute();

    if (listings.length === 0) return [] as ListingWithImages[];
    return hydrateListings(listings);
  });
```

- [ ] **Step 3: Update `getHomepageStats` — count all categories**

```ts
export const getHomepageStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const [countResult, priceResult] = await Promise.all([
    db
      .selectFrom("listing")
      .select([
        sql<number>`count(*)::int`.as("total"),
        sql<number>`count(distinct region)::int`.as("regions"),
      ])
      .where("status", "=", "active")
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("listing_rental")
      .innerJoin("listing", "listing.id", "listing_rental.listing_id")
      .select(sql<number>`coalesce(min(listing_rental.price_per_day), 0)::int`.as("min_price"))
      .where("listing.status", "=", "active")
      .executeTakeFirstOrThrow(),
  ]);

  return {
    totalListings: countResult.total,
    regionCount: countResult.regions,
    minPricePerDay: Math.round(centsToEuros(priceResult.min_price)),
  };
});
```

- [ ] **Step 4: Extend `ListingForDisplay` type and `getListingForDisplay`**

Add `sale`, `gear`, `part` fields to the return type and fetch from child tables:

```ts
export type ListingForDisplay = {
  listing: Listing;
  rental: {
    price_per_day: number;
    price_per_week: number | null;
    price_per_weekend: number | null;
    price_description: string | null;
    mileage_limit: number | null;
  } | null;
  sale: {
    price: number;
    condition: string;
    km_driven: number | null;
    negotiable: boolean;
  } | null;
  gear: {
    gear_type: string;
    size: string | null;
    condition: string;
    price: number;
  } | null;
  part: {
    part_category: string;
    compatible_make_id: string | null;
    compatible_model_id: string | null;
    condition: string;
    price: number;
  } | null;
  images: ListingImage[];
  makeName: string | null;
  makeSlug: string | null;
  modelName: string | null;
};

export async function getListingForDisplay(shortId: string): Promise<ListingForDisplay | null> {
  const db = await getDb();
  const row = await db
    .selectFrom("listing")
    .leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
    .leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
    .selectAll("listing")
    .select([
      "motorcycle_make.name as makeName",
      "motorcycle_make.slug as makeSlug",
      "motorcycle_model.name as modelName",
    ])
    .where("listing.short_id", "=", shortId)
    .where("listing.status", "!=", "removed")
    .executeTakeFirst();

  if (!row) return null;
  const { makeName, makeSlug, modelName, ...listing } = row;

  const [images, rental, sale, gear, part] = await Promise.all([
    db
      .selectFrom("listing_image")
      .selectAll()
      .where("listing_id", "=", listing.id)
      .orderBy("order", "asc")
      .execute(),
    listing.category === "rental"
      ? db
          .selectFrom("listing_rental")
          .select(["price_per_day", "price_per_week", "price_per_weekend", "price_description", "mileage_limit"])
          .where("listing_id", "=", listing.id)
          .executeTakeFirst()
      : Promise.resolve(null),
    listing.category === "sale"
      ? db
          .selectFrom("listing_sale")
          .select(["price", "condition", "km_driven", "negotiable"])
          .where("listing_id", "=", listing.id)
          .executeTakeFirst()
      : Promise.resolve(null),
    listing.category === "gear"
      ? db
          .selectFrom("listing_gear")
          .select(["gear_type", "size", "condition", "price"])
          .where("listing_id", "=", listing.id)
          .executeTakeFirst()
      : Promise.resolve(null),
    listing.category === "part"
      ? db
          .selectFrom("listing_part")
          .select(["part_category", "compatible_make_id", "compatible_model_id", "condition", "price"])
          .where("listing_id", "=", listing.id)
          .executeTakeFirst()
      : Promise.resolve(null),
  ]);

  return {
    listing,
    rental: rental ?? null,
    sale: sale ?? null,
    gear: gear ?? null,
    part: part ?? null,
    images,
    makeName: makeName ?? null,
    makeSlug: makeSlug ?? null,
    modelName: modelName ?? null,
  };
}
```

- [ ] **Step 5: Extend `ListingForEdit` and `getListingForEdit` the same way**

Add the same `sale`, `gear`, `part` nullable fields to `ListingForEdit`. In `getListingForEdit`, add the same four parallel child-table fetches (include `availability_default` in the rental fetch as before). The rental fetch already has `selectAll()` so it returns `availability_default`.

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/listings-queries.ts
git commit -m "feat: searchListings/getListingForDisplay/getListingForEdit support all categories"
```

---

## Task 4: Navigation — category dropdown + i18n keys

**Files:**
- Create: `src/components/nav/category-dropdown.tsx`
- Modify: `src/lib/i18n/resources/fi/common.ts`
- Modify: `src/lib/i18n/resources/en/common.ts`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Add nav translation keys**

In `src/lib/i18n/resources/fi/common.ts`, add to the `nav` object:

```ts
nav: {
  // …existing keys unchanged…
  bikes: "Pyörät",
  sale: "Myynti",
  rental: "Vuokraus",
  gear: "Varusteet",
  parts: "Varaosat",
},
```

Same in `src/lib/i18n/resources/en/common.ts`:

```ts
nav: {
  // …existing keys unchanged…
  bikes: "Bikes",
  sale: "For sale",
  rental: "Rental",
  gear: "Gear",
  parts: "Parts",
},
```

- [ ] **Step 2: Create `src/components/nav/category-dropdown.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "~/lib/i18n";

export function CategoryDropdown() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function handleBlur(e: React.FocusEvent) {
    if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
  }

  return (
    <div ref={ref} className="relative" onBlur={handleBlur}>
      <button
        type="button"
        data-testid="nav-pyorat-dropdown"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm text-white/70 hover:text-white"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t("nav.bikes")}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-white/10 bg-primary shadow-lg"
        >
          <Link
            to="/pyorat/myynti"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            data-testid="nav-pyorat-myynti"
          >
            {t("nav.sale")}
          </Link>
          <Link
            to="/pyorat/vuokraus"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            data-testid="nav-pyorat-vuokraus"
          >
            {t("nav.rental")}
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update nav in `__root.tsx`**

Add import at the top of `__root.tsx`:
```ts
import { CategoryDropdown } from "~/components/nav/category-dropdown";
```

In the nav `<div className="flex items-center gap-4 sm:gap-6">`, replace the two existing links:
```tsx
// Remove:
<Link to="/ilmoitukset" ...>{t("nav.browse")}</Link>
<Link to="/tori" ...>{t("nav.tori")}</Link>

// Add:
<CategoryDropdown />
<Link to="/varusteet" className="text-sm text-white/70 hover:text-white" data-testid="nav-varusteet">
  {t("nav.gear")}
</Link>
<Link to="/varaosat" className="text-sm text-white/70 hover:text-white" data-testid="nav-varaosat">
  {t("nav.parts")}
</Link>
```

Everything else in the nav (Lisää ilmoitus, Omat, UserMenu, LanguageSelector) stays identical.

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/category-dropdown.tsx src/routes/__root.tsx src/lib/i18n/resources/fi/common.ts src/lib/i18n/resources/en/common.ts
git commit -m "feat: nav category dropdown — Pyörät/Myynti/Vuokraus, Varusteet, Varaosat"
```

---

## Task 5: Shared browse component + four browse routes

**Files:**
- Create: `src/components/listings/browse-page.tsx`
- Create: `src/routes/pyorat/myynti/index.tsx`
- Create: `src/routes/pyorat/vuokraus/index.tsx`
- Create: `src/routes/varusteet/index.tsx`
- Create: `src/routes/varaosat/index.tsx`

- [ ] **Step 1: Create `src/components/listings/browse-page.tsx`**

This is a route-agnostic version of the current `BrowsePage` in `ilmoitukset/index.tsx`. Copy the entire `BrowsePage` function and `useAccumulatedPages`/`searchKeyWithoutCursor` helpers from `src/routes/ilmoitukset/index.tsx`, then make four substitutions:

1. Replace `Route.useSearch()` with a `search` prop
2. Replace `Route.useLoaderData()` with an `initialData` prop
3. Replace every `navigate({ to: "/ilmoitukset", ... })` with `navigate({ to: browseTo, ... })`
4. Add a `showMap` prop — if `false`, remove the map toggle button and hide the map view entirely

Full component signature:

```tsx
import type { ListingCategory } from "~/lib/db/schema";
import type { SearchResult } from "~/lib/listings-queries";
import type { MotorcycleMake } from "~/lib/makes";
import type { BrowseSearchParams } from "~/lib/validators";

export interface BrowsePageProps {
  category: ListingCategory;
  initialData: SearchResult & { currentUserId: string | null; makes: MotorcycleMake[] };
  search: BrowseSearchParams;
  browseTo: string;
  showMap?: boolean;
}

export function BrowsePage({ category, initialData, search, browseTo, showMap = true }: BrowsePageProps) {
  // … identical logic from ilmoitukset/index.tsx, with the four substitutions above …
}
```

- [ ] **Step 2: Create `src/routes/pyorat/myynti/index.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage } from "~/components/listings/browse-page";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { searchListings } from "~/lib/listings-queries";
import { getMakes } from "~/lib/makes";
import { getSession } from "~/lib/session";
import { browseSearchSchema } from "~/lib/validators";

export const Route = createFileRoute("/pyorat/myynti/")({
  validateSearch: (search) => browseSearchSchema.parse(search),
  loaderDeps: ({ search }) => {
    const { view, city, ...deps } = search;
    return deps;
  },
  loader: async ({ deps }) => {
    const [result, session, makes] = await Promise.all([
      searchListings({ data: { ...deps, category: "sale" } }),
      getSession(),
      getMakes(),
    ]);
    return { ...result, currentUserId: session?.user.id ?? null, makes };
  },
  head: () => ({
    meta: [
      { title: `Moottoripyörät myytävänä — ${SITE_NAME}` },
      { name: "description", content: "Osta käytetty tai uusi moottoripyörä suoraan omistajalta." },
      { property: "og:url", content: `${SITE_URL}/pyorat/myynti` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pyorat/myynti` }],
  }),
  component: SaleBrowsePage,
});

function SaleBrowsePage() {
  return (
    <BrowsePage
      category="sale"
      initialData={Route.useLoaderData()}
      search={Route.useSearch()}
      browseTo="/pyorat/myynti"
      showMap={true}
    />
  );
}
```

- [ ] **Step 3: Create `src/routes/pyorat/vuokraus/index.tsx`**

Same pattern. `category: "rental"`, `browseTo: "/pyorat/vuokraus"`, `showMap: true`, title: `Moottoripyörien vuokraus — ${SITE_NAME}`.

- [ ] **Step 4: Create `src/routes/varusteet/index.tsx`**

Same. `category: "gear"`, `browseTo: "/varusteet"`, `showMap: true`, title: `Moottoripyörävarusteet — ${SITE_NAME}`.

- [ ] **Step 5: Create `src/routes/varaosat/index.tsx`**

Same. `category: "part"`, `browseTo: "/varaosat"`, `showMap: false`, title: `Moottoripyörän varaosat — ${SITE_NAME}`.

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/components/listings/browse-page.tsx src/routes/pyorat/ src/routes/varusteet/ src/routes/varaosat/
git commit -m "feat: browse routes for sale/rental/gear/parts"
```

---

## Task 6: Legacy redirect routes

**Files:**
- Modify: `src/routes/ilmoitukset/index.tsx`
- Modify: `src/routes/tori/index.tsx`
- Modify: `src/routes/ilmoitukset/$listingId_.$slug.tsx`
- Modify: `src/routes/tori/$itemId_.$slug.tsx`

- [ ] **Step 1: Write e2e tests first (TDD)**

Create `e2e/tests/redirects.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("/ilmoitukset redirects to /pyorat/vuokraus", async ({ page }) => {
  await page.goto("/ilmoitukset");
  await expect(page).toHaveURL(/\/pyorat\/vuokraus/);
});

test("/tori redirects to /varusteet", async ({ page }) => {
  await page.goto("/tori");
  await expect(page).toHaveURL(/\/varusteet/);
});
```

- [ ] **Step 2: Run the tests — expect them to fail**

```bash
pnpm test:e2e --grep "redirects"
```

Expected: FAIL (routes still serve the old pages).

- [ ] **Step 3: Replace `ilmoitukset/index.tsx` with a redirect**

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ilmoitukset/")({
  loader: () => {
    throw redirect({ to: "/pyorat/vuokraus", replace: true });
  },
  component: () => null,
});
```

- [ ] **Step 4: Replace `tori/index.tsx` with a redirect**

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tori/")({
  loader: () => {
    throw redirect({ to: "/varusteet", replace: true });
  },
  component: () => null,
});
```

- [ ] **Step 5: Replace `ilmoitukset/$listingId_.$slug.tsx` with a 301 by category**

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { computeListingSlug } from "~/lib/slug";

const CATEGORY_PATH: Record<string, string> = {
  rental: "/pyorat/vuokraus",
  sale: "/pyorat/myynti",
  gear: "/varusteet",
  part: "/varaosat",
};

export const Route = createFileRoute("/ilmoitukset/$listingId_/$slug")({
  loader: async ({ params }) => {
    const { db } = await import("~/lib/db/index");
    const row = await db
      .selectFrom("listing")
      .leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
      .leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
      .select([
        "listing.short_id",
        "listing.category",
        "listing.city",
        "motorcycle_make.slug as makeSlug",
        "motorcycle_model.name as modelName",
      ])
      .where("listing.short_id", "=", params.listingId)
      .where("listing.status", "!=", "removed")
      .executeTakeFirst();

    if (!row) return;

    const basePath = CATEGORY_PATH[row.category] ?? "/pyorat/vuokraus";
    const slug = computeListingSlug(row.makeSlug ?? null, row.modelName ?? null, row.city);

    throw redirect({
      href: `${basePath}/${row.short_id}/${slug}`,
      statusCode: 301,
      replace: true,
    });
  },
  component: () => null,
});
```

- [ ] **Step 6: Replace `tori/$itemId_.$slug.tsx` with a 301 by category**

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { computeListingSlug, slugify } from "~/lib/slug";

const CATEGORY_PATH: Record<string, string> = {
  rental: "/pyorat/vuokraus",
  sale: "/pyorat/myynti",
  gear: "/varusteet",
  part: "/varaosat",
};

export const Route = createFileRoute("/tori/$itemId_/$slug")({
  loader: async ({ params }) => {
    const { db } = await import("~/lib/db/index");
    const row = await db
      .selectFrom("listing")
      .leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
      .leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
      .select([
        "listing.short_id",
        "listing.category",
        "listing.title",
        "listing.city",
        "motorcycle_make.slug as makeSlug",
        "motorcycle_model.name as modelName",
      ])
      .where("listing.short_id", "=", params.itemId)
      .where("listing.status", "!=", "removed")
      .executeTakeFirst();

    if (!row) return;

    const basePath = CATEGORY_PATH[row.category] ?? "/varusteet";
    const slug =
      row.category === "gear" || row.category === "part"
        ? slugify(row.title)
        : computeListingSlug(row.makeSlug ?? null, row.modelName ?? null, row.city);

    throw redirect({
      href: `${basePath}/${row.short_id}/${slug}`,
      statusCode: 301,
      replace: true,
    });
  },
  component: () => null,
});
```

- [ ] **Step 7: Run redirect tests**

```bash
pnpm test:e2e --grep "redirects"
```

Expected: both pass.

- [ ] **Step 8: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 9: Commit**

```bash
git add src/routes/ilmoitukset/index.tsx "src/routes/ilmoitukset/\$listingId_.\$slug.tsx" src/routes/tori/index.tsx "src/routes/tori/\$itemId_.\$slug.tsx" e2e/tests/redirects.spec.ts
git commit -m "feat: legacy /ilmoitukset and /tori routes redirect to category paths"
```

---

## Task 7: Listing detail shell + non-rental sidebars

**Files:**
- Create: `src/components/listings/listing-detail-shell.tsx`
- Create: `src/components/listings/sale-detail-sidebar.tsx`
- Create: `src/components/listings/gear-detail-sidebar.tsx`
- Create: `src/components/listings/part-detail-sidebar.tsx`

- [ ] **Step 1: Create `listing-detail-shell.tsx`**

The shell renders the left column (gallery, title+badges, location chips, description, report button) and accepts `sidebar` and `mobileBar` as render props. Extract directly from the existing `ListingDetailPage` in `ilmoitukset/$listingId_.$slug.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { ListingGallery } from "~/components/listings/listing-gallery";
import { ReportButton } from "~/components/report-button";
import { LICENSE_CLASSES, LISTING_STATUSES, MOTORCYCLE_TYPES, REGIONS } from "~/lib/constants";
import type { ListingImage } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";
import type { ListingForDisplay } from "~/lib/listings-queries";

interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
}

export interface ListingDetailShellProps {
  data: ListingForDisplay & { ownerReviewSummary: ReviewSummary };
  session: { user: { id: string } } | null;
  backTo: string;
  backLabel: string;
  sidebar: ReactNode;
  mobileBar?: ReactNode;
}

export function ListingDetailShell({
  data,
  session,
  backTo,
  backLabel,
  sidebar,
  mobileBar,
}: ListingDetailShellProps) {
  const { t } = useTranslation("listings");
  const { t: tProfile } = useTranslation("profile");
  const { listing, images, makeName, makeSlug, modelName, ownerReviewSummary } = data;

  const isOwner = session?.user.id === listing.owner_id;
  const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
  const typeLabel =
    MOTORCYCLE_TYPES.find((mt) => mt.value === listing.motorcycle_type)?.label ??
    listing.motorcycle_type;
  const licenseLabel =
    LICENSE_CLASSES.find((l) => l.value === listing.required_license)?.label ?? null;
  const statusLabel = LISTING_STATUSES[listing.status];

  return (
    <div data-testid="listing-detail" className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="mx-auto max-w-4xl px-4 py-4 md:py-8">
        <Link
          data-testid="listing-detail-back"
          to={backTo}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-8">
          <div className="space-y-4">
            <ListingGallery images={images} title={listing.title} />

            <div>
              <div className="flex items-start justify-between gap-3">
                <h1
                  data-testid="listing-detail-title"
                  className="text-xl font-bold text-primary md:text-2xl"
                >
                  {listing.title}
                </h1>
                <div className="flex shrink-0 gap-2">
                  {!!isOwner && (
                    <span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                      {t("card.ownBadge")}
                    </span>
                  )}
                  {listing.status !== "active" && (
                    <span
                      data-testid="listing-status-badge"
                      className="rounded bg-warning/20 px-2 py-1 text-xs font-medium text-warning"
                    >
                      {statusLabel}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {!!typeLabel && (
                  <span
                    data-testid="listing-type"
                    className="flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted"
                  >
                    <Tag className="h-3 w-3" />
                    {typeLabel}
                  </span>
                )}
                <span
                  data-testid="location-info"
                  className="flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted"
                >
                  <MapPin className="h-3 w-3" />
                  {listing.city}, {regionLabel}
                </span>
                {!!licenseLabel && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                    {t("detail.licenseBadge", { license: licenseLabel })}
                  </span>
                )}
                {ownerReviewSummary.averageRating !== null && (
                  <Link
                    to="/profiili/$userId"
                    params={{ userId: listing.owner_id }}
                    className="rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted hover:text-accent"
                  >
                    {ownerReviewSummary.reviewCount === 1
                      ? tProfile("reviews.summaryOne", { rating: ownerReviewSummary.averageRating })
                      : tProfile("reviews.summary", {
                          rating: ownerReviewSummary.averageRating,
                          count: ownerReviewSummary.reviewCount,
                        })}
                  </Link>
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-1.5 text-sm font-semibold text-foreground">
                {t("detail.description")}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {listing.description}
              </p>
            </div>

            {!!session && (
              <div className="text-center">
                <ReportButton targetType="listing" targetId={listing.id} />
              </div>
            )}
          </div>

          {sidebar}
        </div>
      </div>
      {mobileBar}
    </div>
  );
}
```

- [ ] **Step 2: Create `sale-detail-sidebar.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { formatEur } from "~/lib/i18n";
import type { Listing } from "~/lib/db/schema";

const CONDITION_LABELS: Record<string, string> = {
  new: "Uusi",
  excellent: "Erinomainen",
  good: "Hyvä",
  fair: "Tyydyttävä",
  poor: "Huono",
};

interface SaleDetailSidebarProps {
  listing: Listing;
  sale: { price: number; condition: string; km_driven: number | null; negotiable: boolean };
  isOwner: boolean;
  ownerPhoneVisible: boolean;
  ownerPhone: string | null;
  ownerUserId: string;
}

export function SaleDetailSidebar({
  listing,
  sale,
  isOwner,
  ownerPhoneVisible,
  ownerPhone,
  ownerUserId,
}: SaleDetailSidebarProps) {
  return (
    <div id="pricing" className="space-y-4 lg:self-start">
      <div className="rounded-l border border-border bg-card p-5 shadow-sm">
        <div data-testid="price-info" className="mb-4">
          <span data-testid="price-sale" className="text-3xl font-bold text-accent">
            {formatEur(sale.price)}
          </span>
          {sale.negotiable && (
            <span className="ml-2 text-sm text-muted">Hinta joustaa</span>
          )}
        </div>
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted">Kunto</dt>
            <dd className="font-medium text-foreground">
              {CONDITION_LABELS[sale.condition] ?? sale.condition}
            </dd>
          </div>
          {sale.km_driven != null && (
            <div>
              <dt className="text-muted">Kilometrit</dt>
              <dd className="font-medium text-foreground">
                {sale.km_driven.toLocaleString("fi")} km
              </dd>
            </div>
          )}
        </dl>
        {isOwner ? (
          <div className="flex gap-2">
            <Link
              to="/ilmoitukset/$listingId/muokkaa"
              params={{ listingId: listing.short_id }}
              className="flex-1"
            >
              <Button variant="outline" className="w-full" size="sm">
                Muokkaa
              </Button>
            </Link>
            <Link to="/omat" className="flex-1">
              <Button variant="outline" className="w-full" size="sm">
                Omat ilmoitukset
              </Button>
            </Link>
          </div>
        ) : listing.status === "active" ? (
          ownerPhoneVisible && ownerPhone ? (
            <a
              href={`tel:${ownerPhone}`}
              className="block w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover"
            >
              {ownerPhone}
            </a>
          ) : (
            <Link
              to="/profiili/$userId"
              params={{ userId: ownerUserId }}
              className="block w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover"
            >
              Ota yhteyttä
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `gear-detail-sidebar.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { formatEur } from "~/lib/i18n";
import type { Listing } from "~/lib/db/schema";

const CONDITION_LABELS: Record<string, string> = {
  new: "Uusi", excellent: "Erinomainen", good: "Hyvä", fair: "Tyydyttävä", poor: "Huono",
};
const GEAR_TYPE_LABELS: Record<string, string> = {
  helmet: "Kypärä", jacket: "Takki", pants: "Housut",
  boots: "Saappaat", gloves: "Käsineet", other: "Muu",
};

interface GearDetailSidebarProps {
  listing: Listing;
  gear: { gear_type: string; size: string | null; condition: string; price: number };
  isOwner: boolean;
  ownerPhoneVisible: boolean;
  ownerPhone: string | null;
  ownerUserId: string;
}

export function GearDetailSidebar({
  listing, gear, isOwner, ownerPhoneVisible, ownerPhone, ownerUserId,
}: GearDetailSidebarProps) {
  return (
    <div id="pricing" className="space-y-4 lg:self-start">
      <div className="rounded-l border border-border bg-card p-5 shadow-sm">
        <div data-testid="price-info" className="mb-4">
          <span data-testid="price-gear" className="text-3xl font-bold text-accent">
            {formatEur(gear.price)}
          </span>
        </div>
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted">Tyyppi</dt>
            <dd className="font-medium text-foreground">
              {GEAR_TYPE_LABELS[gear.gear_type] ?? gear.gear_type}
            </dd>
          </div>
          {gear.size && (
            <div>
              <dt className="text-muted">Koko</dt>
              <dd className="font-medium text-foreground">{gear.size}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted">Kunto</dt>
            <dd className="font-medium text-foreground">
              {CONDITION_LABELS[gear.condition] ?? gear.condition}
            </dd>
          </div>
        </dl>
        {isOwner ? (
          <div className="flex gap-2">
            <Link to="/ilmoitukset/$listingId/muokkaa" params={{ listingId: listing.short_id }} className="flex-1">
              <Button variant="outline" className="w-full" size="sm">Muokkaa</Button>
            </Link>
          </div>
        ) : listing.status === "active" ? (
          ownerPhoneVisible && ownerPhone ? (
            <a href={`tel:${ownerPhone}`} className="block w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover">
              {ownerPhone}
            </a>
          ) : (
            <Link to="/profiili/$userId" params={{ userId: ownerUserId }} className="block w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover">
              Ota yhteyttä
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `part-detail-sidebar.tsx`**

Same structure as `gear-detail-sidebar.tsx` but for parts. Replace gear-specific fields with:

```tsx
// Props: part: { part_category: string; compatible_make_id: string | null; compatible_model_id: string | null; condition: string; price: number }
// Spec rows: part_category ("Osatyyppi"), condition ("Kunto")
// data-testid="price-part"
```

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/components/listings/listing-detail-shell.tsx src/components/listings/sale-detail-sidebar.tsx src/components/listings/gear-detail-sidebar.tsx src/components/listings/part-detail-sidebar.tsx
git commit -m "feat: ListingDetailShell + sale/gear/part sidebars"
```

---

## Task 8: Four category detail routes

**Files:**
- Create: `src/routes/pyorat/vuokraus/$listingId_.$slug.tsx`
- Create: `src/routes/pyorat/myynti/$listingId_.$slug.tsx`
- Create: `src/routes/varusteet/$listingId_.$slug.tsx`
- Create: `src/routes/varaosat/$listingId_.$slug.tsx`

- [ ] **Step 1: Create the rental detail route**

This is a direct copy of `src/routes/ilmoitukset/$listingId_.$slug.tsx` with two changes:
1. `createFileRoute` path → `"/pyorat/vuokraus/$listingId_/$slug"`
2. All `to="/ilmoitukset/..."` links → `to="/pyorat/vuokraus/..."`
3. Wrap `ListingDetailPage` body in `<ListingDetailShell>` passing the existing `BookingSidebar` and `MobileBottomBar` as `sidebar` and `mobileBar` props.
4. The `back` link uses `backTo="/pyorat/vuokraus"`.

File: `src/routes/pyorat/vuokraus/$listingId_.$slug.tsx`

Keep `submitBookingRequest` server fn identical. Keep all booking logic (`BookingSidebar`, `PricingCard`, `MobileBottomBar`) — move them into this file.

- [ ] **Step 2: Create the sale detail route**

`src/routes/pyorat/myynti/$listingId_.$slug.tsx`:

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ListingDetailShell } from "~/components/listings/listing-detail-shell";
import { SaleDetailSidebar } from "~/components/listings/sale-detail-sidebar";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { centsToEuros } from "~/lib/currency";
import { useTranslation } from "~/lib/i18n";
import { getListingForDisplay, recordView } from "~/lib/listings-queries";
import { getReviewSummaryForUser } from "~/lib/reviews.server";
import { getSession } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";

const getListing = createServerFn({ method: "GET" })
  .inputValidator((shortId: string) => shortId)
  .handler(async ({ data: shortId }) => {
    const session = await getSession();
    const result = await getListingForDisplay(shortId);
    if (!result || result.listing.category !== "sale") return null;

    const request = getRequest();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    recordView(shortId, session?.user.id, ip);

    const [ownerReviewSummary, ownerProfile] = await Promise.all([
      getReviewSummaryForUser(result.listing.owner_id),
      (async () => {
        const { db } = await import("~/lib/db/index");
        return db
          .selectFrom("profile")
          .select(["phone", "show_phone"])
          .where("user_id", "=", result.listing.owner_id)
          .executeTakeFirst();
      })(),
    ]);

    return { ...result, ownerReviewSummary, ownerProfile: ownerProfile ?? null };
  });

export const Route = createFileRoute("/pyorat/myynti/$listingId_/$slug")({
  loader: async ({ params }) => {
    const [result, session] = await Promise.all([
      getListing({ data: params.listingId }),
      getSession(),
    ]);
    if (!result) throw notFound();
    return { ...result, session };
  },
  head: ({ loaderData }) => {
    const l = loaderData?.listing;
    if (!l) return {};
    const price = loaderData?.sale?.price ?? 0;
    const slug = computeListingSlug(loaderData?.makeSlug ?? null, loaderData?.modelName ?? null, l.city);
    const url = `${SITE_URL}/pyorat/myynti/${l.short_id}/${slug}`;
    const title = `${l.title} — ${SITE_NAME}`;
    const desc = `Myydään ${loaderData?.makeName ?? ""} ${loaderData?.modelName ?? ""} (${l.year ?? ""}) — ${l.city}. Hinta ${centsToEuros(price).toFixed(0)} €.`;
    return {
      meta: [{ title }, { name: "description", content: desc }, { property: "og:url", content: url }],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: SaleDetailPage,
  notFoundComponent: () => {
    const { t } = useTranslation("listings");
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted">{t("detail.notFound")}</p>
      </div>
    );
  },
});

function SaleDetailPage() {
  const { listing, sale, images, session, makeName, makeSlug, modelName, ownerReviewSummary, ownerProfile } =
    Route.useLoaderData();
  const { t } = useTranslation("listings");
  const isOwner = session?.user.id === listing.owner_id;

  return (
    <ListingDetailShell
      data={{ listing, rental: null, sale, gear: null, part: null, images, makeName, makeSlug, modelName, ownerReviewSummary }}
      session={session}
      backTo="/pyorat/myynti"
      backLabel={t("detail.back")}
      sidebar={
        <SaleDetailSidebar
          listing={listing}
          sale={sale!}
          isOwner={isOwner}
          ownerPhoneVisible={ownerProfile?.show_phone ?? false}
          ownerPhone={ownerProfile?.phone ?? null}
          ownerUserId={listing.owner_id}
        />
      }
    />
  );
}
```

- [ ] **Step 3: Create `src/routes/varusteet/$listingId_.$slug.tsx`**

Same as sale detail. Differences:
- `createFileRoute` path: `"/varusteet/$listingId_/$slug"`
- Category guard: `result.listing.category !== "gear"`
- Use `GearDetailSidebar` instead of `SaleDetailSidebar`
- `backTo="/varusteet"`
- Meta description references gear/price
- URL: `${SITE_URL}/varusteet/${l.short_id}/${slugify(l.title)}`

For the slug, gear/part listings don't have a make/model, so use `slugify(listing.title)` from `~/lib/slug`.

- [ ] **Step 4: Create `src/routes/varaosat/$listingId_.$slug.tsx`**

Same as gear. Differences:
- Path: `"/varaosat/$listingId_/$slug"`
- Guard: `category !== "part"`
- Use `PartDetailSidebar`
- `backTo="/varaosat"`

- [ ] **Step 5: Write e2e smoke tests**

Create `e2e/tests/categories.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("sale browse page loads", async ({ page }) => {
  await page.goto("/pyorat/myynti");
  await expect(page.getByTestId("listings-grid")).toBeVisible();
});

test("rental browse page loads", async ({ page }) => {
  await page.goto("/pyorat/vuokraus");
  await expect(page.getByTestId("listings-grid")).toBeVisible();
});

test("gear browse page loads", async ({ page }) => {
  await page.goto("/varusteet");
  await expect(page.getByTestId("listings-grid")).toBeVisible();
});

test("parts browse page loads", async ({ page }) => {
  await page.goto("/varaosat");
  await expect(page.getByTestId("listings-grid")).toBeVisible();
});
```

- [ ] **Step 6: Run smoke tests**

```bash
pnpm test:e2e --grep "browse page loads"
```

Expected: all four pass.

- [ ] **Step 7: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 8: Commit**

```bash
git add src/routes/pyorat/ src/routes/varusteet/ src/routes/varaosat/ e2e/tests/categories.spec.ts
git commit -m "feat: detail routes for sale/rental/gear/parts"
```

---

## Task 9: Multi-category create/edit form

**Files:**
- Modify: `src/components/listings/listing-form.tsx`
- Modify: `src/routes/ilmoitukset/uusi.tsx`
- Modify: `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`
- Modify: `src/lib/i18n/resources/fi/listings.ts`
- Modify: `src/lib/i18n/resources/en/listings.ts`

- [ ] **Step 1: Add form i18n keys**

In `src/lib/i18n/resources/fi/listings.ts`, add inside the `form` object:

```ts
sections: {
  // …existing sections…
  category: "Ilmoitustyyppi",
  saleDetails: "Myyntitiedot",
  gearDetails: "Varuste",
  partDetails: "Varaosa",
},
categories: {
  sale: "Myynti",
  rental: "Vuokraus",
  gear: "Varusteet",
  part: "Varaosat",
},
```

Same keys in `src/lib/i18n/resources/en/listings.ts`:

```ts
sections: {
  category: "Listing type",
  saleDetails: "Sale details",
  gearDetails: "Gear",
  partDetails: "Part",
},
categories: {
  sale: "For sale",
  rental: "Rental",
  gear: "Gear",
  parts: "Parts",
},
```

- [ ] **Step 2: Update `ListingFormProps` and add category state**

At the top of `listing-form.tsx`, change the props interface and add imports:

```tsx
import { Key, Shield, ShoppingCart, Wrench, X } from "lucide-react";
import type { ListingCategory } from "~/lib/db/schema";
import type { GearFormData, PartFormData, RentalFormData, SaleFormData } from "~/lib/validators";
import { GEAR_TYPES, CONDITIONS } from "~/lib/validators";

interface ListingFormProps {
  lockedCategory?: ListingCategory;
  initialCategory?: ListingCategory;
  initialValues?: Partial<ListingFormData>;
  initialImages?: ListingImageInput[];
  onSubmit: (data: ListingFormData) => Promise<void>;
  submitLabel?: string;
}
```

Inside `ListingForm`, add before `useForm`:

```tsx
const [category, setCategory] = useState<ListingCategory>(
  props.lockedCategory ?? props.initialCategory ?? "rental",
);
```

- [ ] **Step 3: Add category tile selector section**

After the opening `<form>` tag, insert:

```tsx
{!props.lockedCategory && (
  <section className="rounded-lg border border-border bg-card p-6">
    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
      {t("form.sections.category")}
    </h2>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(["sale", "rental", "gear", "part"] as const).map((cat) => {
        const icons: Record<string, React.ReactNode> = {
          sale: <ShoppingCart className="h-6 w-6" />,
          rental: <Key className="h-6 w-6" />,
          gear: <Shield className="h-6 w-6" />,
          part: <Wrench className="h-6 w-6" />,
        };
        return (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            data-testid={`category-tile-${cat}`}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-colors ${
              category === cat
                ? "border-accent bg-accent/5 text-accent"
                : "border-border bg-background text-foreground hover:border-accent/50"
            }`}
          >
            {icons[cat]}
            {t(`form.categories.${cat}`)}
          </button>
        );
      })}
    </div>
  </section>
)}
```

- [ ] **Step 4: Wrap motorcycle section in a conditional**

Wrap the existing "Moottoripyörä" `<section>` in:

```tsx
{(category === "sale" || category === "rental") && (
  // … existing motorcycle section unchanged …
)}
```

- [ ] **Step 5: Wrap rental price section in a conditional**

Wrap the existing "Hinta" `<section>` in:

```tsx
{category === "rental" && (
  // … existing rental price section unchanged …
)}
```

- [ ] **Step 6: Add sale-specific fields section**

After the rental price section:

```tsx
{category === "sale" && (
  <section className="rounded-lg border border-border bg-card p-6">
    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
      {t("form.sections.saleDetails")}
    </h2>
    <div className="space-y-4">
      <form.Field name="sale_price">
        {(field) => (
          <div>
            <label htmlFor="sale_price" className="mb-1 block text-sm font-medium text-foreground">
              Myyntihinta (€) <span className="text-destructive">*</span>
            </label>
            <Input
              id="sale_price"
              type="number"
              min={1}
              value={field.state.value ?? ""}
              onBlur={field.handleBlur}
              onChange={(e) =>
                field.handleChange(
                  e.target.value === "" ? ("" as unknown as number) : e.target.valueAsNumber,
                )
              }
            />
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field name="sale_condition">
        {(field) => (
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Kunto <span className="text-destructive">*</span>
            </label>
            <Select value={field.state.value ?? ""} onValueChange={(v) => field.handleChange(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Valitse kunto" />
              </SelectTrigger>
              <SelectContent>
                {[
                  ["new", "Uusi"],
                  ["excellent", "Erinomainen"],
                  ["good", "Hyvä"],
                  ["fair", "Tyydyttävä"],
                  ["poor", "Huono"],
                ].map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field name="sale_km_driven">
        {(field) => (
          <div className="w-1/2">
            <label htmlFor="sale_km_driven" className="mb-1 block text-sm font-medium text-foreground">
              Kilometrit
            </label>
            <Input
              id="sale_km_driven"
              type="number"
              min={0}
              value={field.state.value ?? ""}
              onBlur={field.handleBlur}
              onChange={(e) =>
                field.handleChange(e.target.value === "" ? null : e.target.valueAsNumber)
              }
            />
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field name="sale_negotiable">
        {(field) => (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={field.state.value ?? false}
              onChange={(e) => field.handleChange(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm text-foreground">Hinta joustaa</span>
          </label>
        )}
      </form.Field>
    </div>
  </section>
)}
```

- [ ] **Step 7: Add gear-specific fields section**

```tsx
{category === "gear" && (
  <section className="rounded-lg border border-border bg-card p-6">
    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
      {t("form.sections.gearDetails")}
    </h2>
    <div className="space-y-4">
      <form.Field name="gear_gear_type">
        {(field) => (
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Varustetyyppi <span className="text-destructive">*</span>
            </label>
            <Select value={field.state.value ?? ""} onValueChange={(v) => field.handleChange(v)}>
              <SelectTrigger><SelectValue placeholder="Valitse tyyppi" /></SelectTrigger>
              <SelectContent>
                {[["helmet","Kypärä"],["jacket","Takki"],["pants","Housut"],["boots","Saappaat"],["gloves","Käsineet"],["other","Muu"]].map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="gear_size">
          {(field) => (
            <div>
              <label htmlFor="gear_size" className="mb-1 block text-sm font-medium text-foreground">Koko</label>
              <Input id="gear_size" value={field.state.value ?? ""} onChange={(e) => field.handleChange(e.target.value || null)} maxLength={20} />
            </div>
          )}
        </form.Field>

        <form.Field name="gear_condition">
          {(field) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Kunto <span className="text-destructive">*</span></label>
              <Select value={field.state.value ?? ""} onValueChange={(v) => field.handleChange(v)}>
                <SelectTrigger><SelectValue placeholder="Valitse kunto" /></SelectTrigger>
                <SelectContent>
                  {[["new","Uusi"],["excellent","Erinomainen"],["good","Hyvä"],["fair","Tyydyttävä"],["poor","Huono"]].map(([v,l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="gear_price">
        {(field) => (
          <div>
            <label htmlFor="gear_price" className="mb-1 block text-sm font-medium text-foreground">Hinta (€) <span className="text-destructive">*</span></label>
            <Input id="gear_price" type="number" min={1} value={field.state.value ?? ""} onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value === "" ? ("" as unknown as number) : e.target.valueAsNumber)} />
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>
    </div>
  </section>
)}
```

- [ ] **Step 8: Add part-specific fields section**

```tsx
{category === "part" && (
  <section className="rounded-lg border border-border bg-card p-6">
    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
      {t("form.sections.partDetails")}
    </h2>
    <div className="space-y-4">
      <form.Field name="part_part_category">
        {(field) => (
          <div>
            <label htmlFor="part_part_category" className="mb-1 block text-sm font-medium text-foreground">
              Osatyyppi <span className="text-destructive">*</span>
            </label>
            <Input id="part_part_category" placeholder="esim. Jarrulevyt, Ketjusarja, Peili"
              value={field.state.value ?? ""} onChange={(e) => field.handleChange(e.target.value)} maxLength={100} />
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field name="part_condition">
        {(field) => (
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Kunto <span className="text-destructive">*</span></label>
            <Select value={field.state.value ?? ""} onValueChange={(v) => field.handleChange(v)}>
              <SelectTrigger><SelectValue placeholder="Valitse kunto" /></SelectTrigger>
              <SelectContent>
                {[["new","Uusi"],["excellent","Erinomainen"],["good","Hyvä"],["fair","Tyydyttävä"],["poor","Huono"]].map(([v,l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field name="part_price">
        {(field) => (
          <div>
            <label htmlFor="part_price" className="mb-1 block text-sm font-medium text-foreground">Hinta (€) <span className="text-destructive">*</span></label>
            <Input id="part_price" type="number" min={1} value={field.state.value ?? ""} onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value === "" ? ("" as unknown as number) : e.target.valueAsNumber)} />
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>
    </div>
  </section>
)}
```

- [ ] **Step 9: Add new fields to `useForm` defaultValues**

In the `useForm({ defaultValues: { ... } })` call, add after the existing fields:

```ts
// Sale
sale_price: initialCategory === "sale" ? (initialValues as SaleFormData | undefined)?.price ?? ("" as unknown as number) : ("" as unknown as number),
sale_condition: initialCategory === "sale" ? (initialValues as SaleFormData | undefined)?.condition ?? "" : "",
sale_km_driven: initialCategory === "sale" ? (initialValues as SaleFormData | undefined)?.km_driven ?? null : null,
sale_negotiable: initialCategory === "sale" ? (initialValues as SaleFormData | undefined)?.negotiable ?? false : false,
// Gear
gear_gear_type: initialCategory === "gear" ? (initialValues as GearFormData | undefined)?.gear_type ?? "" : "",
gear_size: initialCategory === "gear" ? (initialValues as GearFormData | undefined)?.size ?? null : null,
gear_condition: initialCategory === "gear" ? (initialValues as GearFormData | undefined)?.condition ?? "" : "",
gear_price: initialCategory === "gear" ? (initialValues as GearFormData | undefined)?.price ?? ("" as unknown as number) : ("" as unknown as number),
// Part
part_part_category: initialCategory === "part" ? (initialValues as PartFormData | undefined)?.part_category ?? "" : "",
part_compatible_make_id: initialCategory === "part" ? (initialValues as PartFormData | undefined)?.compatible_make_id ?? null : null,
part_condition: initialCategory === "part" ? (initialValues as PartFormData | undefined)?.condition ?? "" : "",
part_price: initialCategory === "part" ? (initialValues as PartFormData | undefined)?.price ?? ("" as unknown as number) : ("" as unknown as number),
```

- [ ] **Step 10: Update form `onSubmit` to assemble the discriminated union**

Replace the `const parsed = listingFormSchema(tCommon).safeParse(...)` block inside `form.onSubmit` with:

```ts
let formPayload: unknown;

if (category === "rental") {
  formPayload = {
    category: "rental",
    title: value.title, city: value.city, region: value.region,
    postal_code: value.postal_code || null, description: value.description,
    make_id: value.make_id, model_id: value.model_id, year: value.year,
    engine_cc: value.engine_cc, motorcycle_type: value.motorcycle_type,
    required_license: value.required_license,
    price_per_day: value.price_per_day, price_per_week: value.price_per_week,
    price_per_weekend: value.price_per_weekend,
    price_description: value.price_description || null,
    mileage_limit: value.mileage_limit,
    images: allImages,
  };
} else if (category === "sale") {
  formPayload = {
    category: "sale",
    title: value.title, city: value.city, region: value.region,
    postal_code: value.postal_code || null, description: value.description,
    make_id: value.make_id, model_id: value.model_id, year: value.year,
    engine_cc: value.engine_cc, motorcycle_type: value.motorcycle_type,
    required_license: value.required_license,
    condition: value.sale_condition, km_driven: value.sale_km_driven,
    price: value.sale_price, negotiable: value.sale_negotiable,
    images: allImages,
  };
} else if (category === "gear") {
  formPayload = {
    category: "gear",
    title: value.title, city: value.city, region: value.region,
    postal_code: value.postal_code || null, description: value.description,
    gear_type: value.gear_gear_type, size: value.gear_size,
    condition: value.gear_condition, price: value.gear_price,
    images: allImages,
  };
} else {
  formPayload = {
    category: "part",
    title: value.title, city: value.city, region: value.region,
    postal_code: value.postal_code || null, description: value.description,
    part_category: value.part_part_category,
    compatible_make_id: value.part_compatible_make_id,
    condition: value.part_condition, price: value.part_price,
    images: allImages,
  };
}

const parsed = listingFormSchema(tCommon).safeParse(formPayload);
```

- [ ] **Step 11: Update `uusi.tsx` — redirect to category-specific path**

In `handleSubmit`:

```tsx
async function handleSubmit(data: ListingFormData) {
  const result = await createListingFn({ data });
  const slug = computeListingSlug(result.makeSlug, result.modelName, result.city);
  const basePath =
    data.category === "sale"
      ? "/pyorat/myynti"
      : data.category === "rental"
        ? "/pyorat/vuokraus"
        : data.category === "gear"
          ? "/varusteet"
          : "/varaosat";
  navigate({
    to: `${basePath}/$listingId/$slug`,
    params: { listingId: result.shortId, slug },
    replace: true,
  });
}
```

- [ ] **Step 12: Update `$listingId_.muokkaa.tsx` — lock category + redirect**

Pass `lockedCategory` and `initialCategory` to `<ListingForm>`:

```tsx
<ListingForm
  lockedCategory={listing.category as ListingCategory}
  initialCategory={listing.category as ListingCategory}
  initialValues={initialValues}
  initialImages={...}
  onSubmit={handleSubmit}
  submitLabel={t("edit.submitLabel")}
/>
```

In `handleSubmit`:

```tsx
async function handleSubmit(data: ListingFormData) {
  await updateListingFn({ data: { id: listing.id, form: data } });
  const slug = computeListingSlug(makeSlug, modelName, listing.city);
  const basePath =
    listing.category === "sale"
      ? "/pyorat/myynti"
      : listing.category === "rental"
        ? "/pyorat/vuokraus"
        : listing.category === "gear"
          ? "/varusteet"
          : "/varaosat";
  navigate({
    to: `${basePath}/$listingId/$slug`,
    params: { listingId: listing.short_id, slug },
    replace: true,
  });
}
```

Also add `import type { ListingCategory } from "~/lib/db/schema";` at the top.

- [ ] **Step 13: Run typecheck**

```bash
pnpm typecheck
```

Fix any remaining type errors (most likely in the `initialValues` mapping in `muokkaa.tsx` — cast sale/gear/part values from `getListingForEdit` result).

- [ ] **Step 14: Commit**

```bash
git add src/components/listings/listing-form.tsx src/routes/ilmoitukset/uusi.tsx "src/routes/ilmoitukset/\$listingId_.muokkaa.tsx" src/lib/i18n/resources/fi/listings.ts src/lib/i18n/resources/en/listings.ts
git commit -m "feat: multi-category create/edit form with category tile selector"
```

---

## Task 10: Sitemap

**Files:**
- Modify: `src/routes/sitemap[.]xml.ts`

- [ ] **Step 1: Rewrite the sitemap handler**

Replace the entire file:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "~/lib/constants";
import { computeListingSlug, slugify } from "~/lib/slug";

const CATEGORY_PATH: Record<string, string> = {
  rental: "/pyorat/vuokraus",
  sale: "/pyorat/myynti",
  gear: "/varusteet",
  part: "/varaosat",
};

const STATIC_PATHS = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/pyorat/myynti", priority: "0.9", changefreq: "daily" },
  { path: "/pyorat/vuokraus", priority: "0.9", changefreq: "daily" },
  { path: "/varusteet", priority: "0.9", changefreq: "daily" },
  { path: "/varaosat", priority: "0.9", changefreq: "daily" },
  { path: "/kayttoehdot", priority: "0.3", changefreq: "yearly" },
  { path: "/tietosuoja", priority: "0.3", changefreq: "yearly" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { db } = await import("~/lib/db/index");
        const listings = await db
          .selectFrom("listing")
          .leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
          .leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
          .select([
            "listing.short_id",
            "listing.category",
            "listing.title",
            "listing.city",
            "listing.updated_at",
            "motorcycle_make.slug as makeSlug",
            "motorcycle_model.name as modelName",
          ])
          .where("listing.status", "=", "active")
          .orderBy("listing.updated_at", "desc")
          .limit(50_000)
          .execute();

        const urls = [
          ...STATIC_PATHS.map(
            (p) =>
              `<url><loc>${SITE_URL}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
          ),
          ...listings.map((l) => {
            const basePath = CATEGORY_PATH[l.category] ?? "/pyorat/vuokraus";
            const slug =
              l.category === "gear" || l.category === "part"
                ? slugify(l.title)
                : computeListingSlug(l.makeSlug ?? null, l.modelName ?? null, l.city);
            return `<url><loc>${SITE_URL}${basePath}/${l.short_id}/${slug}</loc><lastmod>${new Date(l.updated_at).toISOString().split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
          }),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add "src/routes/sitemap[.]xml.ts"
git commit -m "feat: sitemap emits category-specific URLs, removes /ilmoitukset and /tori"
```

---

## Task 11: Homepage rebrand (#102)

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/lib/i18n/resources/fi/home.ts`
- Modify: `src/lib/i18n/resources/en/home.ts`
- Modify: `src/routes/__root.tsx` (meta + footer)

> **Invoke `frontend-design` skill** when building the category showcase tiles and tabbed listings sections.
> **Invoke `humanizer` skill** on all Finnish and English copy strings before committing.

- [ ] **Step 1: Rewrite `fi/home.ts`**

Run the **humanizer** skill on this copy after writing it. Target: direct Finnish, no rental-only framing.

```ts
export default {
  hero: {
    imgAlt: "Motoristi Kawasaki Ninjalla auringonlaskussa",
    heading: "Motoristien oma yhteisö",
    headingAccent: "",
    subheading:
      "Osta, myy, vuokraa ja vaihda moottoripyöriä, varusteita ja varaosia suoraan toisilta motoristeilta.",
    searchPlaceholder: "Hae merkkiä, mallia tai varusteita...",
    searchButton: "Hae",
    chips: {
      uusimaa: "Uusimaa",
      pirkanmaa: "Pirkanmaa",
      naked: "Naked",
      a2: "A2-kortti",
      touring: "Touring",
    },
    statsListings: "ilmoitusta",
    statsRegions: "aluetta",
    statsPrice: "alk. / pv",
  },
  categories: {
    heading: "Mitä etsit?",
    sale: { label: "Pyörät myyntiin", desc: "Käytetyt ja uudet moottoripyörät" },
    rental: { label: "Vuokraus", desc: "Päiväksi tai viikonlopuksi" },
    gear: { label: "Varusteet", desc: "Kypärät, takit, saappaat ja muuta" },
    parts: { label: "Varaosat", desc: "Osat suoraan muilta motoristeilta" },
  },
  latestListings: {
    heading: "Uusimmat ilmoitukset",
    browseAll: "Selaa kaikkia",
    tabs: {
      sale: "Myynti",
      rental: "Vuokraus",
      gear: "Varusteet",
      parts: "Varaosat",
    },
  },
  cta: {
    heading: "Laita ilmoitus",
    body: "Ilmainen ilmoitus tavoittaa muut motoristit suoraan.",
    button: "Lisää ilmoitus",
  },
  footer: {
    brand: "Motori",
    sale: "Pyörät myyntiin",
    rental: "Vuokraus",
    gear: "Varusteet",
    parts: "Varaosat",
    addListing: "Lisää ilmoitus",
    copyright: "© {{year}} Motori",
  },
} as const;
```

- [ ] **Step 2: Rewrite `en/home.ts`** (same structure, English copy, humanize).

- [ ] **Step 3: Update the homepage loader**

In `src/routes/index.tsx`, change the loader to call `getLatestListings` four times in parallel:

```ts
loader: async () => {
  const [saleListings, rentalListings, gearListings, partListings, stats, session] =
    await Promise.all([
      getLatestListings({ data: "sale" }),
      getLatestListings({ data: "rental" }),
      getLatestListings({ data: "gear" }),
      getLatestListings({ data: "part" }),
      getHomepageStats(),
      getSession(),
    ]);
  const emailVerified = session?.user.emailVerified ?? true;
  return { saleListings, rentalListings, gearListings, partListings, stats, emailVerified };
},
```

- [ ] **Step 4: Rewrite `HomePage` component**

> Invoke `frontend-design` skill for the visual implementation of the category showcase and tabbed listings. Pass it the translation keys and route paths defined above.

Key changes from the current component:

1. **Hero `handleSearch`** → navigates to `/pyorat/myynti?q=`:
```tsx
navigate({ to: "/pyorat/myynti", search: q ? { q } : {} });
```

2. **Remove the seasonal strip** `<div>` entirely.

3. **Replace "Näin se toimii" section** with a category showcase using the `t("categories.*)` keys and links to `/pyorat/myynti`, `/pyorat/vuokraus`, `/varusteet`, `/varaosat`.

4. **Replace the latest listings grid** with a tabbed view:
```tsx
const [activeTab, setActiveTab] = useState<ListingCategory>("sale");
const tabData: Record<ListingCategory, ListingWithImages[]> = {
  sale: saleListings,
  rental: rentalListings,
  gear: gearListings,
  part: partListings,
};
// Tab bar: Myynti / Vuokraus / Varusteet / Varaosat
// Grid: tabData[activeTab].map(listing => <ListingCard ... />)
```

5. **Update the CTA section** to use `t("cta.*)` keys (no rental-specific copy).

- [ ] **Step 5: Update root meta and footer in `__root.tsx`**

Change the default `<head>` title and description:

```ts
{ title: `${SITE_NAME} — Motoristien oma yhteisö` },
{ name: "description", content: "Osta, myy ja vuokraa moottoripyöriä, varusteita ja osia. Suomalainen motoristien yhteisö." },
```

Update the footer links — replace the existing `<Link to="/ilmoitukset">` links with the four category links, using `t("footer.sale")` etc. from `fi/common.ts` (add these keys there too):

In `fi/common.ts` add to footer:
```ts
footer: {
  // …existing…
  sale: "Pyörät myyntiin",
  rental: "Vuokraus",
  gear: "Varusteet",
  parts: "Varaosat",
},
```

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/index.tsx src/lib/i18n/resources/fi/home.ts src/lib/i18n/resources/en/home.ts src/routes/__root.tsx src/lib/i18n/resources/fi/common.ts src/lib/i18n/resources/en/common.ts
git commit -m "feat: homepage rebrand — Motoristien oma yhteisö, category tiles, tabbed listings (#102)"
```

---

## Task 12: E2E test updates

**Files:**
- Modify: all `e2e/tests/*.spec.ts` files that reference `/ilmoitukset` or `/tori`

- [ ] **Step 1: Find stale references**

```bash
grep -rn "/ilmoitukset\|/tori" e2e/ --include="*.ts"
```

Note each file and line.

- [ ] **Step 2: Update each file**

For each hit:
- `/ilmoitukset` browse URLs → `/pyorat/vuokraus`
- `/ilmoitukset/{shortId}/{slug}` detail URLs → `/pyorat/vuokraus/{shortId}/{slug}` (rental seed listings)
- `/tori` → `/varusteet`

The `reviews.spec.ts` test creates a booking flow using rental listings — change its browse URL from `/ilmoitukset` to `/pyorat/vuokraus`.

- [ ] **Step 3: Confirm seed has listings for all four categories**

Open `e2e/global-setup.ts`. Check whether the seed creates sale/gear/part listings. If only rental exists, add seed entries using whatever helper pattern the setup uses. At minimum one active listing per category is needed for the browse smoke tests.

- [ ] **Step 4: Run the full e2e suite**

```bash
pnpm test:e2e
```

Fix any failures.

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "test: update e2e tests for new category routes"
```

---

## Task 13: Final verification

- [ ] **Step 1: Lint and format**

```bash
pnpm lint:fix && pnpm format:fix
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: zero errors.

- [ ] **Step 3: Full e2e suite**

```bash
pnpm test:e2e
```

Expected: all tests pass.

- [ ] **Step 4: Commit any lint/format fixes**

```bash
git add -A
git commit -m "chore: lint and format fixes"
```

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| Browse routes — sale/rental/gear/parts | 5 |
| Detail routes — sale/rental/gear/parts | 8 |
| Legacy /ilmoitukset 301 redirect | 6 |
| Legacy /tori 301 redirect | 6 |
| Nav category dropdown | 4 |
| searchListings category param | 3 |
| ?q= search on all browse pages | 3 |
| Map view disabled for parts | 5 |
| ListingDetailShell shared component | 7 |
| Sale/gear/part sidebars with contact | 7 |
| getListingForDisplay extended | 3 |
| getListingForEdit extended | 3 |
| Discriminated union schema | 1 |
| createListing all categories | 2 |
| updateListing all categories | 2 |
| Form category tile selector | 9 |
| Shared fields preserved on category switch | 9 (separate useState; shared fields always in form) |
| Post-create redirect to category URL | 9 |
| Edit locked category | 9 |
| Sitemap category URLs, no duplicates | 10 |
| Homepage hero + category tiles + tabbed listings | 11 |
| Finnish/English copy humanized | 11 |
| Root meta description updated | 11 |
| Footer links updated | 11 |
| E2E tests updated | 12 |
