# motori

Open-source marketplace for motorcycle rentals, sales, gear, and parts in Finland — production deployment at [motori.fi](https://motori.fi).

## Stack

- **Frontend**: React 19, TanStack Router + Start, Tailwind CSS 4
- **Backend**: Node.js, srvx, Kysely (Postgres)
- **Auth**: BetterAuth
- **Storage**: Hetzner Object Storage (S3-compatible)
- **Email**: Resend (with MJML templates)
- **i18n**: i18next (Finnish, English)
- **Deploy**: Dokku on Hetzner Cloud
- **Tooling**: Biome, Vitest, Playwright, pnpm

## Quick start

```bash
pnpm install
cp .env.example .env          # fill in BETTER_AUTH_SECRET at minimum
docker compose up -d          # local Postgres on :5433
pnpm db:migrate
pnpm db:seed                  # optional: sample data
pnpm dev                      # http://localhost:3000
```

Requires Node 24.x and pnpm 10.33.0 (see `mise.toml`).

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server with HMR |
| `pnpm build` / `pnpm start` | Production build + serve |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | E2E tests (Playwright) |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm db:migrate` | Apply Kysely migrations |
| `pnpm db:codegen` | Regenerate schema types from DB |

## Project layout

pnpm workspace: `apps/*` are deployable apps, `packages/*` are shared libraries (packages never import from apps).

```
apps/motori/
  src/
    routes/            TanStack Router file-based routes (Finnish URLs)
    components/        UI components
    lib/               Domain logic, db, i18n, email, auth
    lib/db/migrations/ Kysely migrations
  e2e/                 Playwright tests
packages/
  db/                  @motori/db — createDb / createMigrator, BetterAuth table types
  server/              @motori/server — csrf, rate-limit, security-headers, nonce, log, email, image-storage, auth factory, session
  ui/                  @motori/ui — theme.css tokens + button/input/select/textarea
docs/                  Architecture notes (ADRs in docs/adr/)
infra/                 Cron + deploy bits
```

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) for the Dokku-on-Hetzner runbook (cloud-init, secrets, TLS, backups).

Production secrets are kept in `secrets/*.age` (encrypted with [age](https://age-encryption.org)). The recipient public key in `justfile` is the maintainer's key — forks should generate their own.

## Contributing

This is primarily a single-operator project, but PRs and issues are welcome. There are no formal contribution guidelines yet — please open an issue first for anything non-trivial.

## License

[MIT](./LICENSE) © 2026 Christian Vilen
