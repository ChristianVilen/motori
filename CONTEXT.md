# CONTEXT.md — domain glossary

Names for the domain concepts and the modules that own them. Grown lazily: a term is added when a module is named after it. Architecture vocabulary (module, seam, depth, locality) is defined in `docs/adr/0001-listing-module.md` and `DEEPENING_OPS.md`.

## Listing

A rental or tori (gear/part) advertisement owned by a user. All Listing database operations live behind the `listings-*` modules in `apps/motori/src/lib/` (commands, detail, search, stats, owner, category) — see ADR-0001 (note: the single-file `listings.ts` described there has since been split by axis).

## Profile

A user's public-facing identity and contact preferences (`profile` table): display name, city, phone + phone visibility, language, terms acceptance. Distinct from the BetterAuth `user` account row, which owns email/credentials. All Profile reads and writes live behind `apps/motori/src/lib/profile.server.ts`:

- **Intent-based reads**: `getProfileForEdit` (own settings form), `getPublicProfile` (safe columns only — never leaks phone or terms; composes the Listing module and reviews for the public page).
- **Two write intents**: `completeProfile` (first-login flow; stamps `terms_accepted_at`, also retroactively when a settings-created row lacks it, never overwriting an existing timestamp) and `updateSettings` (never touches terms).
