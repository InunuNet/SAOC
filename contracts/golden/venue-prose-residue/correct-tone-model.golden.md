# Correct tone model — showFaq-getting-there-3 (live, unchanged, verified 2026-08-12)

This is the FAQ answer to model any rewrite on. It names the real venue, gives what
is genuinely known (the R44, Stellenbosch Airfield, the Cape Winelands), and is
honest about what is not yet settled — no invented specifics.

> "At the hangar at Stellenbosch Flying Club, Stellenbosch Airfield, on the R44 in
> the Cape Winelands. On-site details such as the entrance to use, parking and
> accessibility are still being worked out and will be published here as they are
> settled."

`status: pending` — correctly not claiming "research" for content that is honestly
"we don't know yet."

## Applying this tone to the three defective documents

None of the following is prescriptive exact copy — the dev implementing the fix
should write it — but each rewrite must satisfy the same shape: name what's known,
say "not confirmed" for what isn't, invent nothing.

- **`showFaq-accessibility-1`**: drop "a modern convention centre with step-free
  access and accessible facilities" entirely. Accessibility at an airfield hangar is
  genuinely unresearched — the honest answer is "not confirmed", full stop, same as
  `showFaq-accessibility-2`'s "This has not been confirmed."
- **`showFaq-getting-there-2`**: drop "several parking garages". An airfield has, at
  most, an apron or a field — assert nothing about capacity or structure until the
  committee confirms arrangements.
- **`showFaq-getting-there-1`**: either drop the "roughly half an hour" claim and
  downgrade `status` to `pending`, or replace it with an actually-researched drive
  time/route to Stellenbosch Airfield and keep `status: research`. Rule 5 forbids
  inventing a plausible-sounding number to fill the gap — if nobody drives the route
  before the fix lands, drop the claim.

## v2 addendum — the additional fields now in scope

Same rule, same tone, applied to the fields Finding 1 and Finding 2 added:

- **`nationalShowVenuePatch.venue.directionsNote`** (golden JSON only — the live
  `nationalShow.venue` document already has no `directionsNote` set, correctly, per
  the seed script's own comment): either drop the key entirely, matching the live
  script's choice not to carry over false detail, or replace it with an honest
  "not confirmed" sentence. Never re-describe the Foreshore or invent Stellenbosch
  arrival detail.
- **`showVisitorInfoDocument.{airportRoutes, accommodation, attractions}`** (golden
  JSON): must become `[]`, matching `AIRPORT_ROUTES`/`ACCOMMODATION`/`ATTRACTIONS`
  in the corrected `scripts/seed-show-visitor-info.ts`. This is not prose to
  rewrite — it is stale structured data to delete, exactly as the live script
  already deleted its equivalents rather than inventing Stellenbosch-area
  attractions to replace V&A Waterfront and Kirstenbosch.
- **`showVisitorInfoDocument.publicTransport`** and
  **`showFaq-getting-there-1`/`showFaq.getting-there.1`** (Finding 2): the honest
  answer is silence on public transport, or a hedge ("not confirmed", "not yet
  researched") if it is mentioned at all. Do NOT write "there is no public
  transport" — that is exactly as invented as "the MyCiTi bus serves the venue"
  would be. Nobody has checked either claim.
