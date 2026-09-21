# Studio Navigation — Missing Document Types

## Problem

Three document types were schema-registered and actively used by live pages, but unreachable via Sanity Studio's left-hand navigation:

- `showSponsor` — used by `/national-show/sponsors`
- `vendorNursery` — used by `/national-show/vendors`, `/sa-exhibitors`, `/international-guests`
- `province` — used by `/societies`, `/about`, `/national-show`, and related routes

Editors could still create new documents via the `+ Create` menu, but could not browse, filter, or edit existing ones without accessing Studio's URL directly or using GROQ queries.

## Root Cause

`sanity/structure.ts` defines the left-hand navigation structure. It maintains two lists:

- `PINNED_SINGLETON_TYPES` — fixed single-document types (homepage, contact page, etc.)
- `COLLECTION_TYPES` — browsable collection types

The three document types were defined in `sanity/schemas/index.ts` but **omitted from `COLLECTION_TYPES`** in `structure.ts`, making them invisible in the UI despite being fully schema-registered.

## Fix

Added the three types to the `COLLECTION_TYPES` array in `sanity/structure.ts`:

```typescript
const COLLECTION_TYPES = [
  // ... existing types ...
  'showSponsor',    // used by /national-show/sponsors
  'vendorNursery',  // used by /national-show/vendors, /sa-exhibitors, /international-guests
  'province',       // used by lib/data/provinces.ts, /societies, /about, /national-show
];
```

Also documented two previously-undocumented optional environment variables in `.env.local.example`:

- `NEXT_PUBLIC_SANITY_API_VERSION` — Sanity API version pin (falls back to `2024-10-01` if unset)
- `RESEND_REPLY_TO` — optional Reply-To address for outbound Resend emails

## Future Additions

When adding a new document type to `sanity/schemas/index.ts`:

1. Register the schema type normally
2. Add it to **either** `COLLECTION_TYPES` (for browsable collections) **or** `PINNED_SINGLETON_TYPES` (for fixed single-document types) in `sanity/structure.ts`
3. Omitting this step creates the same reachability gap — the type exists but editors cannot find it in Studio's navigation

If a type needs to be filtered from the `+ Create` menu (like singletons), add it to the `filterNewDocumentOptions` check as well.
