# Motorcycle Makes & Models — Design Spec

**Issue:** #32  
**Date:** 2026-04-19  
**Status:** Approved

## Summary

Replace the free-text `brand`/`model` columns on `listing` with a structured DB-backed make/model catalog. Users can add missing makes or models inline from the listing form. All user-submitted entries are auto-approved (flag present for future admin tooling).

---

## Schema

### New tables

**`motorcycle_make`**
| column | type | constraints |
|--------|------|-------------|
| id | text | PK |
| name | text | NOT NULL |
| slug | text | NOT NULL, UNIQUE |
| approved | boolean | NOT NULL, DEFAULT true |

**`motorcycle_model`**
| column | type | constraints |
|--------|------|-------------|
| id | text | PK |
| make_id | text | NOT NULL, FK → motorcycle_make.id ON DELETE CASCADE |
| name | text | NOT NULL |
| approved | boolean | NOT NULL, DEFAULT true |

No `year_from`/`year_to` — deferred until needed.

### Changes to `listing`

Migration `007`:
- Create `motorcycle_make` and `motorcycle_model` tables
- Drop `brand` (text) and `model` (text) columns
- Add `make_id` (text, NOT NULL, FK → motorcycle_make.id)
- Add `model_id` (text, NULLABLE, FK → motorcycle_model.id)

`model_id` is nullable — a user may not find their model worth adding, or "Muu" make has no curated models.

### FTS trigger update

The existing `listing_fts_update` trigger currently concatenates `brand` and `model`. After migration it uses subselects to pull `motorcycle_make.name` and `motorcycle_model.name` inline:

```sql
coalesce((SELECT name FROM motorcycle_make WHERE id = NEW.make_id), '')
coalesce((SELECT name FROM motorcycle_model WHERE id = NEW.model_id), '')
```

---

## Seed Data

`MOTORCYCLE_BRANDS` constant in `constants.ts` becomes the authoritative makes seed list. Slugs are auto-generated (lowercase, spaces → hyphens). "Muu" is included as a make with no pre-seeded models.

Curated models per make (approved = true):

| Make | Models |
|------|--------|
| Honda | CB500F, CB650R, CBR600RR, Africa Twin, NC750X, Gold Wing |
| Yamaha | MT-07, MT-09, YZF-R1, Ténéré 700, TMAX |
| Kawasaki | Z650, Z900, Ninja 400, Ninja 650, Versys 650 |
| BMW | R 1250 GS, S 1000 RR, F 900 R, R nineT |
| KTM | Duke 390, Duke 790, 890 Adventure |
| Suzuki | GSX-S750, V-Strom 650, Hayabusa |
| Harley-Davidson | Sportster, Street Glide, Fat Boy |
| Ducati | Monster, Panigale V4, Multistrada V4 |
| Triumph | Bonneville, Tiger 900, Street Triple |
| Aprilia | RS 660, Tuono 660, Shiver 900 |
| Royal Enfield | Meteor 350, Himalayan, Classic 350 |
| Husqvarna | Svartpilen 401, Vitpilen 401 |
| Zero | SR/F, DSR/X |
| Indian | Scout, Chief, FTR 1200 |
| Moto Guzzi | V7, V9, V100 Mandello |
| Can-Am | Ryker, Spyder F3 |
| Energica | Ego, Eva |
| Beta | RR 125, RR 300 |
| GasGas | EC 250, MC 350F |
| Husaberg | FE 501, TE 300 |
| Sherco | SE 300, SEF 250 |
| Muu | *(none)* |

---

## Server Functions

All defined with `createServerFn`. `createMake` and `createModel` require an active session.

| Function | Method | Input | Returns |
|----------|--------|-------|---------|
| `getMakes` | GET | — | `{ id, name, slug }[]` |
| `getModels` | GET | `makeId: string` | `{ id, name }[]` |
| `createMake` | POST | `{ name: string }` | `{ id, name, slug }` |
| `createModel` | POST | `{ makeId: string, name: string }` | `{ id, name }` |

`createMake` auto-generates slug from name (lowercase, trim, spaces → hyphens). Duplicate name/slug returns an error the form surfaces inline.

---

## Validators

`listingFormSchema` in `validators.ts`:
- Remove `brand: z.string()` and `model: z.string()`
- Add `make_id: z.string().min(1, "Valitse merkki")`
- Add `model_id: z.string().nullable().optional()`

---

## Form UI — `MakeModelSelect` Component

A new self-contained component at `src/components/listings/make-model-select.tsx`. Used inside `listing-form.tsx` in the Moottoripyörä section, replacing the existing brand Select and model Input.

### Make combobox

- Loads all makes via `getMakes()` on mount
- Renders a controlled text input that filters the list client-side as the user types
- Dropdown (absolute-positioned) shows matching makes; closes on selection or outside click
- Final item always: "Ei löydy listalta — lisää uusi" — clicking reveals an inline input + "Lisää" button
- On confirm: calls `createMake({ name })`, appends result to local list, selects it, clears model
- Selecting a make clears model selection and calls `getModels(makeId)` to populate model list

### Model combobox

- Disabled until a make is selected
- Same combobox pattern: type to filter, "add new" at the bottom
- "Add new" calls `createModel({ makeId, name })`, appends result, selects it
- Leaving model blank is valid (field is nullable)

### Implementation notes

- Built without new library dependencies — controlled input + absolute dropdown, consistent with existing Radix Select usage
- Component receives `onMakeChange(makeId)` and `onModelChange(modelId | null)` callbacks, plus `initialMakeId`/`initialModelId` for the edit form
- Loading and error states shown inline below the field

---

## Listing Display

### Queries

The listing loader (`$listingId.tsx`) and browse query (`ilmoitukset/index.tsx`) join `motorcycle_make` and `motorcycle_model` to get `make_name` and `model_name`. Kysely left joins on `make_id` and `model_id`.

### Display

Everywhere `listing.brand` and `listing.model` are currently rendered, replaced with joined `make.name` and `model.name`. The listing card, detail specs block, and edit form initial values all use the joined names.

---

## Listing Create / Edit

**`uusi.tsx`:** insert `make_id` and `model_id` (nullable) instead of `brand`/`model`.

**`$listingId_.muokkaa.tsx`:** loader passes `make_id` and `model_id` as `initialMakeId`/`initialModelId` to `MakeModelSelect`. Update query sets `make_id` and `model_id`.

---

## Out of Scope

- Admin approval UI (blocked on issue #27)
- Model `year_from`/`year_to` ranges
- Merging duplicate user-submitted makes/models
- Bulk import of comprehensive model catalogs
