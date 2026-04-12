# Vuokramoto — Design System & UX Specification

## Overview

Design document for Vuokramoto, a P2P motorcycle rental noticeboard for Finland. This spec defines the visual language, interaction model, and page-by-page UX that guides implementation.

**Design direction**: Nordic Moto Culture — the intersection of Finnish design sensibility (clean, high-contrast, generous whitespace) and motorcycle culture energy (warm amber accents, tactile interactions). Premium and trustworthy, with enough energy to excite.

**Target emotions**: "This feels premium and trustworthy" + "This is exciting, I want to ride"

---

## User Personas

### Listers (Bike Owners)
- Experienced riders, likely 30-50+
- Have bikes sitting underused in the garage
- Want a dead-simple way to get return on an underused asset
- Value: easy listing flow, trust that their bike is in good hands, minimal hassle

### Renters
- Have a motorcycle license but don't own a bike
- Want the riding experience without ownership overhead (maintenance, storage, insurance)
- Value: finding the right bike quickly, confidence about the owner, frictionless contact

---

## Design Principles

1. **Mobile-first** — most browsing happens on phones. Desktop is secondary.
2. **Photography-forward** — bike images sell. Give them space.
3. **Micro-interactions everywhere** — every touchpoint gives feedback. Nothing feels dead.
4. **Generous breathing room** — fewer listings per screen than competitors, but each one feels considered.
5. **Clean Finnish tone** — professional, Wolt-like. No fluff, no false claims.
6. **Noticeboard, not marketplace** — Vuokramoto connects people. Zero involvement in agreements, insurance, or payments between parties.

---

## Design System Foundations

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#1a1a2e` (deep navy) | Text, headers, nav background |
| `accent` | `#e07a3a` (warm amber) | CTAs, interactive highlights, energy moments |
| `accent-hover` | `#c96830` | Darkened accent for hover/press states |
| `background` | `#fafaf9` (warm off-white) | Page backgrounds |
| `card` | `#ffffff` | Card surfaces |
| `card-elevated` | `#ffffff` + shadow | Cards on hover/active |
| `muted` | `#6b6966` | Secondary text, metadata |
| `muted-light` | `#f0efed` | Dividers, input backgrounds, tag fills |
| `border` | `#e5e4e1` | Card borders, separators |
| `frost` | `rgba(255,255,255,0.85)` + backdrop-blur | Overlay strips on images |
| `destructive` | `#dc2626` | Errors, delete actions |
| `success` | `#16a34a` | Active status, success toasts |
| `warning` | `#d97706` | Paused status, expiry warnings |

### Typography

- **Font**: Inter (400-700 weight range)
- **Scale** (modular, generous jumps for hierarchy):
  - Hero heading: 2.5rem / 700
  - Section heading: 1.5rem / 700
  - Card title: 1.125rem / 600
  - Body: 1rem / 400
  - Caption/meta: 0.875rem / 400, `muted` color
- **Principle**: Type does the heavy lifting. Bold headlines with generous tracking, clean body text. No decorative fonts.

### Spacing & Layout

- **Base grid**: 8px
- **Content max-width**: 1200px
- **Card grid**: responsive columns (1 on mobile, 2 on tablet, 3 on desktop)
- **Card padding**: 16-24px
- **Section spacing**: 48-64px between major sections

### Radius & Shadows

- **Cards**: 12px radius, `0 1px 3px rgba(0,0,0,0.04)` resting shadow
- **Elevated (hover)**: `0 8px 24px rgba(0,0,0,0.08)` with 2px Y-lift via transform
- **Buttons**: 8px radius
- **Inputs**: 8px radius
- **Badges/tags**: 6px radius

---

## Micro-Interactions System

### Physics Model

All animations use spring physics rather than linear/ease curves. Natural, weighted feel.

| Profile | Stiffness | Damping | Use |
|---------|-----------|---------|-----|
| Quick response | 300 | 24 | Buttons, toggles, small elements |
| Medium motion | 200 | 20 | Cards lifting, panels sliding |
| Gentle settle | 150 | 18 | Modals, full-screen transitions |

**Accessibility**: `prefers-reduced-motion` → instant state changes, no animation.

### Interaction Catalog

| Element | Trigger | Effect |
|---------|---------|--------|
| **Card** | Hover/press | Lifts 2px on Y-axis, shadow expands, subtle scale(1.01) |
| **Card** | Touch start (mobile) | Slight scale-down (0.98) then release lifts — "press and pop" |
| **Favorite heart** | Tap | Throttle-twist: icon rotates 15deg clockwise then snaps back while filling with amber |
| **CTA button** | Hover | Background shifts from amber to darker amber, slight inner glow |
| **CTA button** | Press | Scales to 0.96, snaps back on release |
| **Filter chip** | Toggle on | Fills with `primary` color, text goes white, chip gently expands to fit |
| **Filter chip** | Toggle off | Color drains out left-to-right |
| **Contact reveal** | Tap | Unlock animation — button splits horizontally, halves slide apart, contact info rises from beneath |
| **Image gallery** | Swipe (mobile) | Momentum-based with rubber-band edges, dots indicator pulses on land |
| **Loading skeleton** | While fetching | Gentle pulse (opacity 0.4 to 0.7), not shimmer — calmer feel |
| **Navigation** | Route change | Content fades out (100ms) then fades in (150ms) with 8px upward shift |
| **Scroll to top** | Scroll past fold | FAB fades in with scale spring, tapping scrolls with deceleration curve |
| **New listing badge** | Appear | Amber dot scales in with overshoot bounce |
| **Price tag** | Listing < 1hr old | Single subtle pulse to draw attention, then stops |

### Signature Moments

1. **Contact reveal** — The "Nayta yhteystiedot" button doesn't just disappear. It mechanically "unlocks": the button splits horizontally, the two halves slide apart, and the contact info rises from beneath. Feels like opening a latch.

2. **Listing creation success** — After publishing, the new listing card animates into "My listings" with a satisfying drop-and-settle (spring overshoot). A brief amber checkmark pulses once.

---

## Page Specifications

### Homepage

**Purpose**: Communicate what Vuokramoto is, build trust instantly, get users browsing within seconds.

**Navigation**:
- **Desktop**: Sticky top bar, `primary` background, Vuokramoto wordmark left, "Kirjaudu" button right. On scroll: subtle bottom border appears.
- **Mobile**: Fixed bottom bar with 4 icons — Etsi (search/home), Suosikit (favorites), Ilmoita (create listing), Profiili (profile/login). Active tab highlighted with amber accent.

**Layout (top to bottom):**

1. **Hero section** — full-width, moderate height (60vh mobile, 50vh desktop). Single high-quality motorcycle photo (slightly darkened) with text overlay:
   - Headline: "Vuokraa moottoripyora" — large, white, Inter 700
   - Subtitle: "Loyta pyora suoraan omistajalta — ilman valikasiа" — white, Inter 400
   - Inline search bar on frosted glass strip: rounded input with region dropdown + amber search button

2. **Trust bar** — horizontal row of key stats/trust signals. Clean icons + numbers: "150+ pyoraa", "12 aluetta", "Ilmainen ilmoitus". No decoration.

3. **Latest listings** — "Uusimmat ilmoitukset" heading + "Nayta kaikki" link. Grid of 4-6 listing cards (1 col mobile, 3 col desktop).

4. **How it works** — 3-step horizontal layout: "Selaa pyoria → Ota yhteytta → Aja". Minimal icons, short copy.

5. **CTA for listers** — "Pyorasi seisoo tallissa?" + "Lisaa ilmoitus" amber button. Differentiates the two audiences.

6. **Footer** — minimal. Key page links, language toggle (FI/EN), copyright.

---

### Listing Card

The building block — used in browse, homepage, favorites, and dashboard.

**Structure:**
```
+-------------------------------+
|                               |
|     [Motorcycle photo]        |
|        (aspect 4:3)           |
|                               |
|  +-------------------------+  |
|  | Frosted glass bar       |  |
|  | Honda CB650R  .  2021   |  |
|  +-------------------------+  |
+-------------------------------+
|  Helsinki, Uusimaa            |
|  A2  .  Naked                 |
|                               |
|  45 EUR/pv             <3     |
+-------------------------------+
```

- Photo takes ~60% of card height, 4:3 aspect ratio
- Frosted glass strip overlays bottom of photo with bike name + year
- Below photo: location, license class badge, motorcycle type
- Bottom row: price (bold, slightly larger) + favorite heart (right-aligned)
- "Uusi" amber dot badge on listings < 24h old (top-left corner of photo)
- Card hover/press: spring-lift interaction
- **Mobile**: Full-width single column, slightly taller photos

---

### Browse / Search Page

**Purpose**: Find the right bike fast. Powerful filtering without overwhelming the UI.

**Layout:**

1. **Search header** — sticky. Text search input (pre-filled from homepage) + "Suodata" button with active filter count badge.

2. **Filter panel**:
   - Mobile: bottom sheet (half-screen, draggable to full)
   - Desktop: sidebar
   - Filters: Region (dropdown), Motorcycle type (chips), License class (chips), Price range (min/max EUR/pv), Brand (searchable dropdown), Availability toggle
   - Filter chips use fill/drain toggle animation
   - "Tyhjenna" (clear all) link at bottom
   - Results update live (debounced 300ms)

3. **Results toolbar** — result count ("47 ilmoitusta") + sort dropdown (Uusimmat, Hinta asc, Hinta desc)

4. **Results grid** — listing cards, infinite scroll with breathing skeleton loader (3 placeholder cards)

5. **No results** — "Ei tuloksia nailla hakuehdoilla. Kokeile laajentaa hakua." + clear filters button

**Key UX decisions:**
- Infinite scroll (no pagination buttons)
- Filter state in URL params (shareable)
- Scroll position preserved when returning from listing detail
- Search input clear button springs in when text present

---

### Listing Detail Page

**Purpose**: Give the renter all info needed to decide, then make contacting the owner effortless.

**Layout:**

1. **Image gallery** — full-width mobile, max 800px desktop. Swipeable carousel, momentum physics, rubber-band edges. Dot indicators (amber active). Tap for fullscreen lightbox with pinch-to-zoom. Counter badge "3/8" top-right.

2. **Title block**:
   - "Honda CB650R . 2021" — large heading
   - "Mikon pyora . Helsinki" — muted
   - License badge + type badge (small filled chips)

3. **Price block** — slightly elevated card-within-page:
   - `45 EUR/pv` — large, bold
   - `250 EUR/vk` — secondary (if set)
   - Optional free-text price note

4. **Details grid** — 2-column, icon + label + value:
   - Engine (cc)
   - Mileage limit
   - Helmet included (Kylla/Ei)
   - Availability dates

5. **Description** — owner's free-text. Line breaks preserved, max-width 65ch for readability.

6. **Contact section** (signature moment):
   - Amber CTA: "Nayta yhteystiedot"
   - Tap → unlock/latch animation → phone/email revealed
   - If not logged in: redirect to login, then return with info revealed
   - Below revealed info: "Muista mainita ilmoituksen otsikko yhteydenotossa"

7. **Owner card** — avatar/initials circle, display name, member since, listing count, "Nayta profiili" link

**Mobile-specific:**
- Fixed bottom bar with amber "Nayta yhteystiedot" appears after scrolling past inline CTA
- Back button preserves browse scroll position

---

### Listing Creation Flow

**Purpose**: Dead simple for bike owners to get listed. Single scrollable form, not a multi-step wizard.

**Sections:**

1. **Photos** (top, most prominent)
   - Drop zone (desktop) / "Lisaa kuvia" button (mobile)
   - Max 8 images, first = cover
   - Drag to reorder (spring physics on dragged item)
   - Upload progress: amber ring fills around each thumbnail
   - Minimum 1 photo required

2. **Motorcycle info**
   - Title (free text)
   - Brand (searchable dropdown)
   - Model (free text)
   - Year (number)
   - Engine cc (number)
   - Required license (A1/A2/A radio chips)
   - Motorcycle type (chips)

3. **Pricing**
   - Price per day EUR/pv (required)
   - Price per week EUR/vk (optional)
   - Free-text price note (optional)

4. **Location**
   - Region (dropdown)
   - City (text)
   - Postal code (optional)

5. **Availability**
   - Available from / to (date pickers, optional — empty = available now)

6. **Description**
   - Textarea, placeholder: "Kerro pyorastasi, varustelusta ja mahdollisista ehdoista"
   - This is where owners mention insurance/deposit/terms in their own words

7. **Publish bar** — sticky bottom on mobile
   - "Esikatsele" secondary button
   - "Julkaise ilmoitus" amber CTA
   - Success: listing card drops into "My listings" with spring-settle animation

**Validation**: Inline, field-level (Zod). Errors fade in below fields. Required fields marked with asterisk.

**Auto-save**: Draft to localStorage — survives navigation.

---

### Profile & Dashboard

#### My Dashboard (private)

1. **Header** — "Hei, [name]" + settings gear icon
2. **Tab bar**:
   - "Ilmoitukseni" (My listings) — default if user has listings
   - "Suosikit" (Favorites) — default if no listings
3. **My Listings tab**:
   - Own listing cards with status dots (green=active, yellow=paused, grey=expired)
   - Context menu (three dots) → Edit / Pause / Delete
   - "Lisaa ilmoitus" card at end (dashed border, amber plus icon)
   - Empty: "Et ole viela lisannyt ilmoituksia" + "Lisaa ensimmainen" button
4. **Favorites tab**:
   - Favorited listing cards
   - Removed listings: faded with "Ei enaa saatavilla" overlay
   - Empty: "Et ole viela tallentanut suosikkeja" + "Selaa ilmoituksia" link

#### Public Profile

- Avatar/initials circle, display name, city, member since
- Grid of user's active listings
- Minimal — no bio or reviews for MVP

#### Settings

- Display name, city, phone (optional), license class, language toggle (FI/EN)
- "Kirjaudu ulos" (logout)
- "Poista tili" (delete account) — requires confirmation dialog

---

### Login & Auth

**Login page** (`/auth/login`):

- Centered card layout
- Vuokramoto wordmark at top
- Social login buttons:
  - "Jatka Googlella" (white bg, dark border, Google icon)
  - "Jatka Facebookilla" (blue bg, Facebook icon)
- Divider with "tai" (or)
- Email + password form:
  - Email input
  - Password input (show/hide toggle)
  - "Kirjaudu" amber button
  - "Ei tilia? Rekisteroidy" link
  - "Unohditko salasanan?" link
- Below all: "Kirjautumalla hyvaksyt kayttoehdot"

**Registration form:**
- Email
- Password (with strength indicator bar)
- Confirm password
- "Luo tili" amber button
- Then → email verification → profile completion

**Email verification** (email+password signups only):
- After registration → "Vahvista sahkopostisi" page
- Message: "Lahetimme vahvistuslinkin osoitteeseen [email]. Tarkista sahkopostisi."
- Resend link available after 60s cooldown
- Until verified: can browse but cannot create listings or reveal contact info
- After clicking verification link → profile completion step

**Profile completion** (first login only, both social and email):
- Display name (pre-filled from OAuth if available)
- City (dropdown)
- Phone (optional)
- License class (A1/A2/A chips, optional)
- "Valmis" amber button

**Auth UX details:**
- Protected actions redirect to login, then return to original intent
- Session via cookie — persistent
- Logged-in state: profile icon in bottom nav gets subtle amber ring

---

## Component Inventory

| Category | Components |
|----------|-----------|
| **Layout** | Navbar (desktop), BottomNav (mobile), Footer, PageContainer, SectionHeader |
| **Cards** | ListingCard, ListingCardSkeleton, OwnerCard, StatCard (trust bar) |
| **Forms** | TextInput, TextArea, NumberInput, Select, SearchableSelect, DatePicker, FileUpload, ChipGroup, RadioChips |
| **Buttons** | Button (primary/secondary/ghost/destructive), IconButton, FAB (scroll-to-top) |
| **Feedback** | Badge (status dots, "Uusi"), Toast (success/error), InlineError, SkeletonPulse |
| **Overlays** | BottomSheet (mobile filters), Lightbox (image gallery), ConfirmDialog |
| **Navigation** | TabBar, FilterChip, SortDropdown, BackButton |
| **Auth** | SocialLoginButton, EmailLoginForm, RegistrationForm, ProfileCompletionForm |
| **Listing-specific** | ImageGallery, ContactReveal, ListingForm, StatusIndicator |

---

## Differentiation from Competitors

What makes Vuokramoto feel different from nettimoto and similar Finnish vehicle sites:

1. **Breathing room** — fewer listings per screen, each one feels considered
2. **Contextual storytelling** — owner quotes, riding personality tags, not just dry specs
3. **Tactile interactions** — spring physics, card lift, throttle-twist favorite
4. **Identity through typography** — bold type hierarchy does the work, not decoration
5. **Signature moments** — contact reveal latch, creation success animation
6. **Bottom nav on mobile** — feels like a native app, not a responsive website

---

## Out of Scope (Future Considerations)

- Payment processing / Turo-like model (potential pivot if platform gains traction)
- Deposit/insurance fields (owners mention in description for now)
- In-app messaging (P1)
- Reviews/ratings (P1)
- Map-based browsing (P2)
- Seasonal UI theme shifts
