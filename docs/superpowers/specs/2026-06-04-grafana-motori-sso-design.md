# Grafana ↔ Motori SSO (OIDC) — Design

**Date:** 2026-06-04
**Status:** Approved design, pending spec review
**Branch:** `feat/logging-service`

## Context

Motori self-hosts Grafana + Loki for log aggregation (see `infra/observability/`, `DEPLOY.md` §11).
Today Grafana has its own login: a separate admin password in prod and anonymous-admin locally.
We want the **Motori admin to reach Grafana with their normal Motori account** — no second set of
credentials — and for non-admins to be kept out (logs can contain PII).

BetterAuth 1.6.3 (already used for app auth) ships an `oidc-provider` plugin, so the clean,
standard way is **SSO**: Motori becomes an OpenID Connect provider and Grafana delegates login to
it via its built-in generic-OAuth. Chosen over a forward-auth reverse proxy (bespoke nginx +
cross-subdomain cookies, hard to mirror locally) and over keeping a separate Grafana password.

## Goal

An admin opens Grafana, clicks **"Sign in with Motori"**, authenticates with their existing
Motori account, and lands in Grafana as an **Admin**. Non-admins are **denied**. Works in prod
(`grafana.motori.fi`) and in the main local dev checkout.

## Non-goals

- Per-worktree SSO (worktree Grafanas stay anonymous-admin — see §6).
- Replacing the existing app login modal for normal users (the new `/login` page is only the
  landing point for the OAuth flow / SSO).
- Provisioning Grafana teams/folders per Motori role beyond the single Admin-vs-denied mapping.
- Dynamic OAuth client registration (Grafana is the only client, pre-registered).

## Decisions (defaulted; flip on review)

- **Non-admin Motori users → denied** Grafana access (`role_attribute_strict`, no fallback role).
  Rationale: logs may contain PII; only admins should read them.
- **SSO scope → prod + main dev checkout.** Worktree Grafanas (offset ports) stay anonymous-admin.

## Architecture / flow

```
Admin browser ──(1) open grafana.motori.fi ─────────────► Grafana (OIDC client)
   ▲                                                          │ (2) no session → 302
   │                                                          ▼
   │                 Motori IdP: /api/auth/oauth2/authorize  (BetterAuth oidc-provider)
   │ (3) if no Motori session → /login → normal Motori login
   │                                                          │ (4) 302 back with ?code
   │                                                          ▼
   │   Grafana back-channel: POST /api/auth/oauth2/token  →  id_token + access_token
   │                          GET  /api/auth/oauth2/userinfo → { sub, email, name, role }
   └──(5) Grafana maps role=admin → Admin; else denied ──────┘
```

Motori = OpenID Connect provider. Grafana = registered OIDC client (generic-OAuth).
The `role` claim drives Grafana's org-role mapping.

## Components

### A. Motori as the OIDC provider

**`src/lib/auth.ts`** — add `oidcProvider()` to the existing `plugins: [admin()]` array:

- `trustedClients: [{ clientId: "grafana", clientSecret: <env GRAFANA_OIDC_SECRET>,
  redirectURLs: [<prod>, <main-dev>], skipConsent: true, ... }]` — Grafana is pre-registered, so
  no consent screen and no dynamic registration.
- `getAdditionalUserInfoClaim: (user) => ({ role: user.role })` — surfaces the Motori `role`
  column to Grafana via userinfo / id_token.
- `loginPage: "/login"` — where the plugin redirects an unauthenticated user mid-authorize.
- `requirePKCE: true` (Grafana supports PKCE; tightens the flow).
- `allowDynamicClientRegistration: false`.

Endpoints exposed under the existing auth base (`/api/auth`):
`/.well-known/openid-configuration`, `/oauth2/authorize`, `/oauth2/token`, `/oauth2/userinfo`.

**DB migration** — new `src/lib/db/migrations/NNN_oidc_provider.ts` creating BetterAuth's
`oauthApplication`, `oauthAccessToken`, `oauthConsent` tables (**camelCase** columns, per the
auth-table convention in `schema.ts`). Add matching Kysely interfaces to `src/lib/db/schema.ts`
and the `Database` union. Run `pnpm db:migrate` then `pnpm db:codegen`. (Even with a single
trusted client, the plugin persists tokens/consents in these tables.)

**`/login` route** — `src/routes/login.tsx`. Motori currently logs in via a modal
(`LoginModal`), but the OAuth authorize step needs a real page to land on and bounce back from.
A minimal full-page login that reuses `~/lib/auth-client`, and on success returns to the
`redirect`/authorize URL passed by the plugin. Unauthenticated normal users are unaffected
(modal stays).

### B. Grafana as the OIDC client

Grafana generic-OAuth, configured by env (compose in dev, age-encrypted dokku config in prod):

```
GF_AUTH_GENERIC_OAUTH_ENABLED=true
GF_AUTH_GENERIC_OAUTH_NAME=Motori
GF_AUTH_GENERIC_OAUTH_CLIENT_ID=grafana
GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET=<GRAFANA_OIDC_SECRET>
GF_AUTH_GENERIC_OAUTH_SCOPES=openid profile email
GF_AUTH_GENERIC_OAUTH_AUTH_URL=<motori>/api/auth/oauth2/authorize
GF_AUTH_GENERIC_OAUTH_TOKEN_URL=<motori>/api/auth/oauth2/token
GF_AUTH_GENERIC_OAUTH_API_URL=<motori>/api/auth/oauth2/userinfo
GF_AUTH_GENERIC_OAUTH_USE_PKCE=true
GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_PATH=contains(role,'admin') && 'Admin' || ''
GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_STRICT=true
GF_AUTH_GENERIC_OAUTH_ALLOW_SIGN_UP=true
```

- Admin → Grafana **Admin**; anyone else → empty role → **denied** (`STRICT=true`).
- **Prod:** set `GF_SERVER_ROOT_URL=https://grafana.motori.fi`, disable anonymous access
  (remove the dev `GF_AUTH_ANONYMOUS_*`), optionally `GF_AUTH_OAUTH_AUTO_LOGIN=true` and hide the
  built-in form — but keep the admin password as **break-glass**.
- **Dev:** Grafana runs in a container, so browser-facing `AUTH_URL` uses `http://localhost:3000`
  while the back-channel `TOKEN_URL`/`API_URL` must reach the host as `http://host.docker.internal:3000`.
  Exact issuer/host values get nailed down during implementation/testing (§7).

### C. Dev / prod parity & the worktree wrinkle

- **Prod:** redirect URI `https://grafana.motori.fi/login/generic_oauth`. Clean.
- **Main dev checkout:** redirect URI `http://localhost:3001/login/generic_oauth`.
- **Worktrees:** Grafana on offset ports (e.g. 3274). OIDC redirect URIs must be pre-registered
  exactly, and registering every ephemeral worktree port is impractical — so worktree Grafanas
  **keep anonymous-admin** (the dev compose only enables OAuth when the OAuth env vars are present;
  worktrees simply don't set them). A specific worktree port can be added to `redirectURLs` on
  demand if SSO is ever needed there.

### D. Secrets & config

- `GRAFANA_OIDC_SECRET` (the client secret): random, shared by both sides.
  - Prod: in `secrets/observability.sh.age` (Grafana side) and `secrets/dokku-config.sh.age`
    (Motori side, as `GRAFANA_OIDC_SECRET`), via the existing age + `config-apply` pattern.
  - Dev: plain in the root `docker-compose.yml` Grafana env + Motori `.env`.
- Keep `.env.ci` / `.env.example` in sync if a new required env var is introduced.

## Acceptance criteria

- An admin clicks "Sign in with Motori" on Grafana and lands as a Grafana **Admin** without a
  second password (prod and main dev).
- A non-admin Motori user is **denied** Grafana access.
- The existing Grafana admin password still works as break-glass (prod).
- App login for normal Motori users is unchanged.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass; migration applies cleanly.

## Testing

1. Local (main checkout): bring up the stack, enable the dev OAuth env, log into Grafana as an
   admin via Motori → Admin role; log in as a non-admin → denied.
2. Verify break-glass admin login still works.
3. Confirm the `/login` page round-trips the authorize flow and returns to Grafana.
4. Prod smoke (per `DEPLOY.md`): register the prod redirect URI, set secrets, sign in.

## Risks / notes

- **YAGNI flag:** this is real surface area (an OAuth IdP + a migration + a `/login` route) for
  "admin signs into Grafana with their Motori password." Justified by unified accounts + no
  separate secret to rotate, but it is more than a Grafana password in 1Password.
- **Motori becomes an OAuth IdP.** Mitigations: single pre-registered trusted client, PKCE,
  dynamic registration disabled, strict redirect-URI allow-list, client secret age-encrypted.
- **Dev host resolution** (`host.docker.internal`) and OIDC issuer matching are the fiddly bits;
  resolve concretely during implementation.

## Files touched

- `src/lib/auth.ts` — add `oidcProvider()` plugin
- `src/lib/db/migrations/NNN_oidc_provider.ts` (new) + `src/lib/db/schema.ts` — oauth tables
- `src/routes/login.tsx` (new) — full-page login landing for the OAuth flow
- `docker-compose.yml` — dev Grafana OAuth env (main checkout)
- `infra/observability/` / `DEPLOY.md` §11 — prod Grafana OAuth + redirect URI + secrets
- `secrets/*.age` — `GRAFANA_OIDC_SECRET`
- `.env.example` / `.env.ci` — new env var if required
