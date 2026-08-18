# CONTEXT.md — domain glossary

Names for the domain concepts and the modules that own them. Grown lazily: a term is added when a module is named after it. Architecture vocabulary (module, seam, depth, locality) is defined in `docs/adr/0001-listing-module.md` and `DEEPENING_OPS.md`.

## Listing

An advertisement owned by a user, in one of four categories: `rental`, `sale` (a motorcycle for sale), `gear` (riding gear), `part` (a spare part). "Tori" is the retired umbrella name for the non-rental categories — don't use it for new things. All Listing database operations live behind the `listings-*` modules in `apps/motori/src/lib/` (commands, detail, search, stats, owner, category) — see ADR-0001 (note: the single-file `listings.ts` described there has since been split by axis).

## Listing status

`active` (publicly listed) · `paused` (hidden by the seller, nothing sold) · `sold` (deal done — leaves browse but the ad stays reachable with a Myyty banner; freely reversible to `active` because deals fall through) · `rented` (rental counterpart) · `expired` (the 90-day lifetime ran out — renewable from the dashboard indefinitely; rental listings don't expire) · `removed` (gone — the only status the public detail page hides). Sold and paused are distinct on purpose: paused answers "hide it", sold answers "it went". Decided in #165.

## Gear size

A coarse letter bucket (`XS`–`XXL`, `muu`), not a garment measurement. It exists for filtering: numeric sizing (helmet cm, boot EU) maps to the nearest letter or `muu`, and the exact measurement belongs in the listing description. Decided in #166.

## Profile

A user's public-facing identity and contact preferences (`profile` table): display name, city, phone + phone visibility, language, terms acceptance. Distinct from the BetterAuth `user` account row, which owns email/credentials. All Profile reads and writes live behind `apps/motori/src/lib/profile.server.ts`:

- **Intent-based reads**: `getProfileForEdit` (own settings form), `getPublicProfile` (safe columns only — never leaks phone or terms; composes the Listing module and reviews for the public page).
- **Two write intents**: `completeProfile` (first-login flow; stamps `terms_accepted_at`, also retroactively when a settings-created row lacks it, never overwriting an existing timestamp) and `updateSettings` (never touches terms).
