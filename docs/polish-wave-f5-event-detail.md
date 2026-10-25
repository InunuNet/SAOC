# Polish wave F5 - event detail

Target: `app/(marketing)/events/[slug]/page.tsx`.

- SV-1: a National Show event (`isNationalShowEvent`, the same title test `/events` uses) renders the
  existing `ShowBand` under the meta table. The show identity comes from `nationalShowQuery`. No
  `detailsHref` is passed, so the secondary CTA stays the NOS root. `ShowBand` is unchanged.
- SV-2: the kind chip (`data-event-kind`) is block-level on its own line, 16px above the h1. The
  "All events" back link is `min-h-11` (44px); the chip's top margin was reduced to keep the visible
  spacing under the back link the same.

## Open CTA label question

The ruling names the CTAs "Tickets" and "National Show". The existing band's labels are
"Book tickets" and "Show details" (plus "Exhibitor info"). Renaming would be new copy on a shared
component and would change the home and `/events` bands, so the band is used exactly as it is. The
checks pin hrefs, not labels. Decision is open with the lead.
