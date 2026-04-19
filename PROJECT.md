# Vuokramoto — P2P Motorcycle Rental Noticeboard for Finland

## Context

Build a Tori.fi/Craigslist-style noticeboard for peer-to-peer motorcycle rentals in the Finnish market. No payments processed — users list motorcycles, browse, and contact owners directly. The platform's value is structured search, trust signals, and a clean Finnish-language experience.

**Name**: vuokramoto ("rental booth")
**Tagline**: "Vuokraa moottoripyörä — tai ilmoita omasi vuokralle"

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | TanStack Start (React) | Fullstack TypeScript, file-based routing, SSR, server functions |
| Styling | Tailwind CSS v4 + shadcn/ui | Component primitives for rapid MVP, good TanStack Start support |
| Database | PostgreSQL 17 | Full-text search (Finnish stemmer), PostGIS-ready for future maps |
| Query Builder | **Kysely** | Type-safe SQL query builder, no magic — explicit queries, great PostgreSQL support |
| Auth | BetterAuth (Google + Meta social login) | Session management, OAuth, pairs with Kysely via adapter |
| Image Storage | Hetzner Object Storage (Helsinki) | S3-compatible, Finnish data residency, single vendor with VPS, presigned URLs for direct browser upload |
| Email | Resend | Simple transactional email API |
| Validation | Zod | Form + server function validation, TanStack ecosystem standard |
| Search | PostgreSQL full-text search (`tsvector`, Finnish config) | Sufficient at Finnish-market scale, no extra service |
| PWA | vite-plugin-pwa | Service worker, manifest, offline shell |
| **Production** | **Hetzner VPS + Object Storage (Helsinki DC)** | Finnish data residency, low latency, single vendor, ~8 EUR/month VPS |
| Reverse Proxy | Caddy | Automatic HTTPS via Let's Encrypt |
| Containers | Docker Compose | App + PostgreSQL + Caddy |

---

## Project Structure

```
vuokramoto/
  app.config.ts              # TanStack Start config
  package.json
  tsconfig.json
  docker-compose.yml
  Dockerfile
  Caddyfile
  .env.example

  app/
    client.tsx               # Client entry
    router.tsx               # TanStack Router config
    ssr.tsx                   # SSR entry
    routeTree.gen.ts          # Auto-generated route tree

    routes/
      __root.tsx             # Root layout (nav, footer, providers)
      index.tsx              # Homepage (hero, search, latest listings)
      auth/
        login.tsx            # Login (Google + Meta buttons)
        callback.tsx         # OAuth callback
      listings/
        index.tsx            # Browse/search results
        $listingId.tsx       # Listing detail
        new.tsx              # Create listing (protected)
        $listingId.edit.tsx  # Edit listing (protected, owner only)
      profile/
        index.tsx            # Dashboard (my listings, saved)
        $userId.tsx          # Public profile
        settings.tsx         # Account settings
      messages/              # P1
        index.tsx
        $conversationId.tsx
      api/
        auth/$.ts            # BetterAuth catch-all
        listings/            # CRUD endpoints
        images/presign.ts    # R2 presigned upload URL

    components/
      ui/                    # shadcn/ui components
      layout/                # Navbar, Footer, MobileNav
      listings/              # ListingCard, ListingForm, FilterBar, ListingGallery
      auth/                  # AuthButtons, ProtectedRoute
      common/                # LocationPicker, LicenseClassBadge, SeasonBadge

    lib/
      db/
        index.ts             # Kysely instance + dialect config
        schema.ts            # Kysely Database interface (type definitions)
        migrations/          # Kysely migrations (up/down functions)
      auth.ts                # BetterAuth server config
      auth-client.ts         # BetterAuth client config
      storage.ts             # Hetzner Object Storage presign helpers (S3-compatible)
      search.ts              # PostgreSQL FTS helpers
      validators.ts          # Zod schemas
      constants.ts           # Finnish regions, license classes, motorcycle types
      i18n.ts                # Simple Finnish/English translations
```

---

## Data Model

### Kysely Database Interface

```typescript
// lib/db/schema.ts
interface Database {
  user: UserTable; // BetterAuth managed
  session: SessionTable; // BetterAuth managed
  account: AccountTable; // BetterAuth managed
  verification: VerificationTable; // BetterAuth managed
  profile: ProfileTable;
  listing: ListingTable;
  listing_image: ListingImageTable;
  favorite: FavoriteTable;
  conversation: ConversationTable; // P1
  message: MessageTable; // P1
  review: ReviewTable; // P1
  report: ReportTable; // P1
}
```

### Core Tables

**profile** — extends BetterAuth user with motorcycle-specific data:

- `user_id` (PK, FK -> user), `display_name`, `phone`, `show_phone`, `city`, `region`, `bio`, `license_class` (A1/A2/A), `language` (fi/en)

**listing** — motorcycle rental ad:

- Identity: `id`, `owner_id` (FK -> user)
- Motorcycle: `title`, `brand`, `model`, `year`, `engine_cc`, `required_license`, `motorcycle_type`
- Pricing: `price_per_day` (EUR cents), `price_per_week`, `price_description`, `deposit_amount`
- Location: `city`, `region`, `postal_code`
- Availability: `available_from`, `available_to`, `season_only`
- Details: `description`, `includes_helmet`, `includes_insurance`, `insurance_info`, `mileage_limit`
- Status: `status` (active/paused/rented/removed), `view_count`, `expires_at` (90-day auto-expiry)
- Search: `search_vector` (tsvector, GIN-indexed)
- Indexes: `(region, status)`, `(motorcycle_type, status)`, `(required_license, status)`

**listing_image**: `id`, `listing_id`, `url`, `thumbnail_url`, `order`

**favorite**: `(user_id, listing_id)` composite PK

**conversation** (P1): `id`, `listing_id`, `sender_id`, `receiver_id`

**message** (P1): `id`, `conversation_id`, `sender_id`, `content`, `read_at`

**review** (P1): `id`, `listing_id`, `reviewer_id`, `target_user_id`, `rating` (1-5), `comment`

**report** (P1): `id`, `reporter_id`, `listing_id`, `user_id`, `reason`, `description`, `status`

---

## Finnish Market Constants

- **Regions**: Uusimaa (Helsinki, Espoo, Vantaa), Pirkanmaa (Tampere), Varsinais-Suomi (Turku), Pohjois-Pohjanmaa (Oulu), Keski-Suomi (Jyvaskyla), Pohjois-Savo (Kuopio), Paijat-Hame (Lahti), Satakunta (Pori), Pohjanmaa (Vaasa), Lappi (Rovaniemi), etc.
- **License classes**: A1 (<=125cc, <=11kW, age 16+), A2 (<=35kW, age 18+), A (unrestricted, age 24+)
- **Motorcycle types**: Naked, Sport, Touring, Adventure, Cruiser, Enduro, Motocross, Scooter, Custom
- **Brands**: Honda, Yamaha, Kawasaki, Suzuki, KTM, BMW, Ducati, Triumph, Harley-Davidson, Husqvarna, etc.
- **Riding season**: April-October (display seasonal banners outside this window)

---

## Key Flows

### Authentication

1. BetterAuth catch-all API route at `/api/auth/*`
2. Login page with "Jatka Googlella" + "Jatka Facebookilla" buttons
3. After first login -> profile completion step (display name, city, phone optional)
4. Protected routes via `beforeLoad` guard in TanStack Router

### Image Upload

1. Client validates files (JPEG/PNG/WebP, max 5MB, max 8 images)
2. Client requests presigned PUT URL from `/api/images/presign`
3. Client uploads directly to Hetzner Object Storage (no server bandwidth cost)
4. Listing saved with object storage public URLs

### Search

- PostgreSQL `tsvector` with `finnish` text search configuration
- GIN index on `search_vector` column
- Combined FTS + structured filters (region, price range, type, license)
- Cursor-based pagination (`created_at` + `id`)
- Sort: newest, price asc/desc, relevance

### Contact (MVP)

- "Nayta yhteystiedot" button reveals phone + email (if provided)
- P1 adds in-app messaging to reduce spam exposure

---

## Design Direction

### Color Palette (Nordic-inspired)

- Primary: `#1a1a2e` (deep navy)
- Accent: `#e07a3a` (warm amber -- motorcycle energy)
- Background: `#fafaf9` (warm off-white)
- Muted: `#f0efed` / `#6b6966`
- Card: `#ffffff`, Border: `#e5e4e1`

### Typography

- Inter for headings + body (clean, Nordic feel, excellent Finnish character support)

### Design Principles

- Generous whitespace, card-based layouts with subtle shadows
- Photography-forward (bike images are the product)
- Mobile-first, thumb-friendly touch targets
- Minimal color -- grayscale with accent for CTAs

---

## Deployment (Hetzner Helsinki)

```
Internet -> Caddy (HTTPS) -> TanStack Start (Node.js :3000) -> PostgreSQL 17
                                                             -> Hetzner Object Storage hel1 (images)
                                                             -> Resend (email)
```

- **VPS**: Hetzner CPX21 (~8 EUR/month), Helsinki datacenter
- **Docker Compose**: app + db + caddy containers
- **Backups**: Daily pg_dump to Object Storage via cron
- **Object Storage**: Hetzner Object Storage in hel1 (Helsinki) — S3-compatible, create bucket via Hetzner Cloud Console
- **CI/CD**: GitHub Actions -> build -> SSH deploy (or Docker registry + Watchtower)
- **Domain**: vuokramoto.fi
