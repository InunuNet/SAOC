# NOS landing changes — expected result (Brad 2026-11-09)

Sources: Lee-Ann's "Questions for Lee-Ann" Google Doc, "Landing page (Home Page)" items 1, 3, 4, 5 and her venue answer (4), all added 5 Nov 2026; Brad's chat instructions 2026-11-09 (verbatim below). Every word below comes from one of those; add none of our own (docs/rules/no-invention.md).

Brad, verbatim: "Ok Lets do the landing page changes, Fix the heading to "National Orchid Show - Western Cape 2027", ... Remove thelline with - 3 Years, 13 Judging groups and 18 National Show editions, Lets Also fix the venue name. ... Change the logos in the footer to be the vertical full color."
Brad, verbatim: "Yes, let's also update point four and five of us where we remove exhibit and trade and then just have the links and change the names to be plant entry vendors to vendors and remove international guests."

## 1. Hero heading (app/(nos)/national-show/page.tsx)
The NOS home `<h1>` reads exactly `National Orchid Show - Western Cape 2027` (spaced hyphen, as Brad typed it; it also matches the hyphen in her About doc). Only the h1 changes. Page metadata and the nav label stay unchanged.

## 2. Figures strip removed
The `3 Years / 13 Judging Groups / 18 National Show Editions` list under the intro is no longer rendered. Delete LANDING_FIGURES and its LandingFigure type from lib/data/nos-home-landing.ts, and update that file's header comment to cite this removal (Brad 2026-11-09, her note item 3). The intro tagline and both intro paragraphs stay.

## 3. Exhibit & trade band → links only
In the `data-hm-section="exhibit"` band:
- Remove the visible "Exhibit & trade" h2 and both paragraphs (EXHIBIT_LEAD, EXHIBIT_BODY), and delete those constants.
- Keep the link list in the same styling (`nos-hm-register`), with exactly two links in this order:
  - `Plant Entry` → the existing `exhibitors` leaf href.
  - `Vendors` → the existing `vendors` leaf href.
- No International guests link.
- The labels are home-page overrides. Do NOT change components/nos-chrome/nos-nav.ts: the nav and footer keep their current labels, because the tab restructure is a separate, not-yet-approved item.
- The band must still be accessible without a visible heading. Give the `<ul>` (or the section) an `aria-label` built from the two link labels, e.g. "Plant Entry and Vendors". Add no new visible words.

## 4. Venue name in code (app/(nos)/national-show/plan-your-visit/page.tsx)
Her answer: the venue is "Hangar 25, Orca Aero Solutions, Stellenbosch Airfield".
- VENUE_ADDRESS line 1: `The Hangar, Stellenbosch Flying Club` → `Hangar 25, Orca Aero Solutions`. The remaining lines are unchanged.
- VENUE_SENTENCE: swap only the venue name. Result: `The show is held at Hangar 25, Orca Aero Solutions, on the R44 at Stellenbosch Airfield in the Cape Winelands.`
- DESIGNATED_PARKING ("…provided at the Stellenbosch flying club…") is her parking instruction, not the venue name. Leave it unchanged.
- lib/show-contact.ts already carries the new venue. Leave it.

## 5. Venue name in Sanity (staged, NOT run)
Two published docs carry the old name: `nationalShow` and `show-19-2027`, fields `venue.name` and `venue.directionsNote`.
- Write `scripts/sanity-venue-name-1109.mjs`. It sets `venue.name` to `Hangar 25, Orca Aero Solutions`, and in `venue.directionsNote` replaces exactly `the hangar at Stellenbosch Flying Club` with `Hangar 25, Orca Aero Solutions`.
- It is dry-run by default: print a before/after for each doc and exit 0.
- `--apply` patches each doc with an `ifRevisionID` guard. The orchestrator runs it only after Brad approves the push.
- Never print the token.

## 6. Footer logos: vertical, full colour (components/nos-chrome/NosFooter.tsx)
- NOS lockup:
  - Use the supplied `NOS-2027-logo-full-colour-reversed-vertical.png`. It is the full-colour vertical made for dark grounds, and the footer ground is dark navy.
  - Copy it unchanged from `branding/National Show 2027/Logo/` to `public/images/`. Never modify branding/.
  - Same 3272×2876 dimensions as the current gold file, so the size constants stay.
  - Remove nothing else from public/images.
- SAOC lockup (vertical, dark ground):
  - Show the full-colour emblem (`public/images/Eulophia-speciosa-emblem.png`, the approved Eulophia speciosa emblem) in place of the greyscale `saoc-emblem-footer-lapis` artwork.
  - Add this as a new opt-in SaocLockup variant used only by NosFooter. Every other SaocLockup call site renders byte-identically.
  - The emblem must render at the same visual size as today. The colour PNG is square with transparent margin, so if needed derive a tight-cropped copy with a committed script; do not hand-edit pixels.
  - The wordmark, rule and tagline are unchanged.


## 3a. Amendment (Brad 2026-11-09, after seeing it locally): the links move into the plant-entry band
Brad, verbatim: "Now that we've removed that section from the bottom of the landing page, those two links, plant entries and vendors, are just hanging around nowhere. ... Let's put those stray links underneath the section for start planning your entry now."
- Delete the `data-hm-section="exhibit"` band entirely, wrapper section included.
- In the `data-hm-section="plant-entry"` band, render the same list at the very end of the band, directly after the paragraph "The 19th National Orchid Show opens on 23rd September 2027 in Stellenbosch.". It is the same `ul.nos-hm-register` with `aria-label="Plant Entry and Vendors"`, and exactly two links, Plant Entry (exhibitors leaf href) and Vendors (vendors leaf href), with the same → arrows and styling as before.
- Nothing else in the plant-entry band changes. "Register Here" stays plain text with its one StatusMarker.
- Item 3 above is superseded where it conflicts.
