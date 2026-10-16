# nos-critique-r6

Source for every item: lead saoc-2b, 2026-10-17 (R80/R63/R82/SEO lane), relaying Brad.

## f2 — R63: NOS-scoped not-found for /national-show/*

An unmatched URL under `/national-show` used to render the SAOC root not-found inside the root
layout alone, with no NOS header or footer. `app/(marketing)/national-show/[...slug]/page.tsx`
now calls `notFound()` for any URL no real route owns, and
`app/(marketing)/national-show/not-found.tsx` renders inside the NOS chrome and `.nos-theme`
with HTTP 404. Copy is the SAOC root not-found eyebrow, headline and first sentence verbatim;
the second sentence is cut because it points at SAOC society links this page does not carry.
Recovery links use the nav-config labels: National Show, Tickets, Plan your visit.
`app/not-found.tsx` is unchanged.
