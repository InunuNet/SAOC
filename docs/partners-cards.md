# PartnersSection — Editorial Cards

**Component:** `components/home/PartnersSection.tsx`
**Contract:** `contracts/partners-cards.yaml` (24 assertions, all green)

---

## Purpose

Renders the "In collaboration with" section on the home page as a responsive grid of editorial cards — one card per partner organisation. Replaces the former bordered-grid box layout.

---

## Card Anatomy

Each card contains four stacked elements:

| Element | Implementation |
|---------|----------------|
| Badge | `<span className="eyebrow">` with the partner category string |
| Heading | `<h3>` in `font-serif` at 20 px — the partner name |
| Description | `<p>` in `font-sans` at 14 px, `text-ink/70` — 1–2 sentences |
| Footer | `border-t border-rule` ruled separator with a right-aligned `→` arrow |

Cards with a `website` value render as `<a target="_blank" rel="noopener noreferrer">` so they open externally without leaving the current page. Cards without a website (e.g. World Orchid Conference) render as `<div>`. Both share identical visual treatment and a `group-hover` translate on the arrow.

**No logos.** The Sanity `partners` schema has a `logo` field, but no partner logos exist in the CMS. The component does not render images.

---

## Layout

```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6
```

Six partners produce a 2×3 grid at `lg` breakpoint (≥1024 px), 3×2 at `sm` (≥640 px), and a single column on mobile.

---

## Data Flow

```
PartnersSection({ partners? })
  └─ toCards(partners)
       ├─ if partners is null/undefined/empty → return STATIC_PARTNERS
       └─ otherwise → map SanityPartner[] to PartnerCard[]
```

### STATIC_PARTNERS fallback

Six hard-coded `PartnerCard` entries are embedded in the module. They are used whenever Sanity returns no data (empty array, null, or the prop is omitted). This ensures the section is never blank, even before the CMS is seeded.

| ID | Badge | Has website |
|----|-------|-------------|
| `wosa` | Local Partner | Yes |
| `sanbi` | Local Partner | Yes |
| `kirstenbosch` | Botanical Garden | Yes |
| `aos` | International | Yes |
| `rhs` | International | Yes |
| `woc` | International | No |

### Sanity-sourced data

When `SanityPartner[]` is passed in, `toCards()` maps each entry:

```ts
badge:       p.tier ?? 'Partner'   // Sanity tier string, fallback 'Partner'
name:        p.name                // required in schema
description: p.description ?? ''   // optional, blank if missing
website:     p.website             // null = div, string = anchor
```

The `logo` field from `SanityPartner` is intentionally ignored — there are no partner logos.

---

## Adding or Editing a Partner

### Via Sanity CMS (recommended for production)

Add a document to the `partners` collection with at minimum: `name`, `tier` (one of `Local Partner`, `Botanical Garden`, `International`), and `description`. Set `website` to the partner's URL or leave it null.

Once any partner documents exist in Sanity and are passed to the component, the static fallback is bypassed entirely and only the CMS data is rendered.

### Via static fallback (no CMS)

Edit `STATIC_PARTNERS` in `components/home/PartnersSection.tsx` directly. Add a new entry following the `PartnerCard` interface:

```ts
interface PartnerCard {
  _id: string;      // unique identifier (used as React key)
  badge: string;    // category label shown in the eyebrow
  name: string;     // partner name, rendered in serif
  description: string;
  website: string | null;  // null → renders as div, not a link
}
```

Do not add an `image` or `logo` field — neither the interface nor the card template renders one.

---

## Interfaces

```ts
// Sanity CMS shape (input)
interface SanityPartner {
  _id: string;
  name: string;
  tier: string | null;
  logo: SanityImageSource | null;   // accepted but not rendered
  website: string | null;
  description: string | null;
}

// Internal card shape (rendered)
interface PartnerCard {
  _id: string;
  badge: string;
  name: string;
  description: string;
  website: string | null;
}
```

---

## Related

- Home page: `app/(marketing)/page.tsx`
- SAOC/WOSA scope boundary: `CLAUDE.md` — SAOC is cultivation; WOSA covers wild orchid conservation
- Design tokens: `app/globals.css` (`eyebrow`, `font-serif`, `bg-parchment`, `border-rule`)
