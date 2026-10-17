# nos-critique-r8

Round 8 of the National Orchid Show critique. Specs and checks live in
`.agent/memory/project/specs/nos-critique-r8/`; the base is main at `8e1d31d7`.

## F1 — the R11 chip on one line at narrow widths

At 375px the disclosure chip wrapped on exhibitors, what-to-expect and both plan-your-visit groups.
Every disclosure chip (`ShowStatusLine` and `VisitDisclosure`) now uses the same inclusive `<=700px`
rule, spelled out as `[@media(max-width:700px)]` (0.06em tracking, 10px inline padding), because
Tailwind's bare 700px variant compiles to `width < 700px` and left exactly 700px untightened. A
`[@media(max-width:419px)]` step drops the tracking to 0.02em; the 12px size and the 10px padding
stay. No bare 700px variant is left under the NOS trees. CSS only, no copy change.

## F2 — the Getting-there lede follows the status rule

The section lede ("... has not been worked out yet") is false once any item is confirmed.
`gettingThereLede(intro, items)` (`components/show/VisitDisclosure.tsx`) returns the trimmed intro
only while every item is unconfirmed (pending, research or unset), and the page passes its result
to the heading. No items counts as every item unconfirmed; a missing or blank intro stays withheld.
Live data has nothing confirmed, so the lede still shows.

## F3 — --green-1 and --green-2

`--green-1: #a7a841` and `--green-2: #7f7d33` are defined in `nos-theme.css` next to the gold tokens,
from nos-v4 `index.html` l.19-20. The holding note's link underline uses plain `var(--green-1)`,
without the inline fallback that hid the missing token.

## F4 — small fixes from the interim QA

Attraction ids are `visit-attraction-<index>-<safe key>`, index first so duplicate keys cannot
collide, with the key lower-cased and every run outside `[a-z0-9_-]` replaced by a dash (no key, no
suffix). `TravelRoutes` headings are h3 under the page's h2 (they were h4). The stale comment on
plan-your-visit's labels is reworded.

## F5 - the emergency section

`VisitEmergency` (`components/show/VisitDisclosure.tsx`) draws the section. The national dial numbers
sit directly under the h2 as plain tel links (44px targets, Fraunces numerals, no surface, no chip),
whatever the status says. The on-site contact follows `status.emergencyContacts`: unconfirmed, it is
one pale disclosure with one chip, the contact label as an h3 and the note as the foot (the inline
value tag is dropped); confirmed, it is plain. No on-site contact means no disclosure; no contacts
renders nothing. This deviates from nos-v4 golden l.605-616 per Codi's FINAL ruling.

## F1 addendum - zero tracking at 374px and below

Codi FINAL: at 374px and narrower the chip has letter-spacing 0 (the 0.02em step could not fit it at 360px). 375-419px keeps 0.02em and 420-700px keeps 0.06em. Measured: normal at 360 and 374, 0.24px at 375 and 419, 0.72px at 420 and 700.

The section is a full-bleed band of --gold (nos-v4 plan-your-visit.html l.277-279): VisitEmergency renders a NosSection, and the page places it after the main NosSection and before the CtaBand. The h2 sits 32px above the numbers, and the band stays whatever the status.

## F1 addendum - the short tag at 359px and below

Codi FINAL: at 359px and narrower a pending chip shows the existing short tag instead of the full label; the group aria-label keeps the full text. `StatusMarker` (opt-in `shortOnNarrow`, forwarded by `ConfirmationBadge`, passed by `ShowStatusLine` and every disclosure badge) renders both spans and switches them with display at the 359/360 boundary, so only one is in the accessibility tree. The short tag is `StatusMarker`'s own `FALLBACK_PENDING_LABEL`. Research chips keep their full text (no ruled short form; flagged to the lead).
