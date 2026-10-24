# NOS Design ruling EV-1..EV-6 (final), relayed 2026-10-24

<cross-session-message from="uds:/tmp/cc-socks/65698.sock" from-name="NOS Design" from-mode="bypass">
Two things: an HD-1 addendum, then the /events design spec Brad asked for.

HD-1b (addendum, the same "same sizes" logic): SAOC's page container is 1216, while NOS and the new header are 1320 + 2×gutter. With only the header widened, the SAOC lockup and the h1/content left edges would stop lining up. So the SAOC page container goes to max-width calc(1320px + 2 × clamp(16px, 2.5vw, 32px)) site-wide, matching NOS. Lockup, h1 and body left edges are then equal on both hosts. Gate: content left edge equal ±1 on both hosts at 2056, 1440 and 1280. Same PR as HD-1 if the architect agrees; otherwise straight after.

/events design (Brad: "no description or write-up… half-baked hero… then a list"). Today it scores 24/40: no orientation, no featured content, the one real event isn't listed, and it's all placeholder rows. Target is about 35/40 when it's built. No new prose anywhere; slots hold Lee-Ann's copy.

EV-1 Hero: mirror-PR layout, keeping today's eyebrow "SAOC calendar", h1 "Events" and our existing lede. No change beyond the mirror PR.

EV-2 Featured event band, directly under the hero: the 19th National Show (the real Sanity event).
- Reuse the existing SAOC home ShowBand/countdown component as-is: photo, title, dates, venue and countdown, all from data.
- Primary action goes to /events/19th-south-african-national-orchid-show. Secondary is the existing "19th National Show, 2027" button to nos.saoc.co.za.
- This gives the page a real lead instead of opening on a bare list. The ShowBand photo follows the inventory ruling (the S3 left cluster, ≥2200 wide, no stem end).

EV-3 Write-up slot (the explanation Brad is missing): a two-column section after the band, at the 1320 container.
- Left (max 62ch): an eventsPage.intro portable-text field in Sanity for Lee-Ann's wording.
- In preview, until it's filled, show the site's existing awaiting-copy marker. In public mode with the field empty, the section collapses; no marker reaches the public.
- Right: the actions column.
  - "Find your society" (existing string) → /societies, since the societies run most local events.
  - A calendar-subscribe button → /api/events.ics, styled as the outline button.
  - COPY GAP: the subscribe label has no source. My recommendation is "Subscribe to calendar". It goes to the Lee-Ann doc, or to Brad, to approve before the button ships.

EV-4 Event list, per the golden (pages-show-events-contact.jsx event-row):
- Rows grouped by month. The month label is a real h2 in the serif at 24px/400, not the 12px mono label, so the list has scannable structure.
- Each row: a date block (day, MON, year), then eyebrow "kind · province", title in the serif, venue, host right-aligned, and →.
- The whole row is one link to /events/[slug] when a detail page exists, min-height 44.
- Hover/focus: a title underline plus a 2px left accent bar. No box or ring (NAV-1 family).
- The featured event is excluded from the list, so it isn't shown twice.

EV-5 Controls only when they help: the Kind chips and Month select (golden, chips per SO-1) render only when there are ≥6 upcoming listed events. Below that they're hidden, because filters that can't narrow anything are noise.

EV-6 Sparse and empty states:
- Preview keeps today's AI-placeholder rows with their badge.
- Public excludes them. With zero listed events, the list section is omitted entirely, so the page is hero → featured band → write-up and actions. No "no events" box and no invented sentence.

Gate: shots at 1280, 768 and 390 in preview and public, plus a 0-listed-events public state. Targets ≥44, heading list in the PR, and the served-width bar on the band photo.

Sequence: after NAV-1/HD-1, as you planned.
</cross-session-message>