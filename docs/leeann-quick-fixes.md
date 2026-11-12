# Lee-Ann quick fixes (2026-11-11)

Source: Lee-Ann's Questions doc (B6-B10, B14, B18). Nothing here goes beyond her wording.

## What changed
- F1: contact page surname is now Caral-Anne van der Westhuizen.
- F2: "19th National Orchid Show" / "19th National Show" became
  "National Orchid Show - Western Cape 2027" (nav lead label, landing sentence, seeds, llms-full.txt).
- F3: venue is Hangar 25, Orca Aero Solutions, Stellenbosch Airfield (seeds, show-pages JSON).
- F4: NOS nav has Plant Entry under Programme, a one-link Vendors group, and no International guests.
  Route manifest, ShowSectionNav, ShowBand and page titles follow.
- Redirects: /national-show/international-guests -> /national-show/vendors (308), in
  next.config.ts and in proxy.ts (both hosts). The page files stay on disk; the route is not indexable.
- Sanity (production 26yfbug4), applied by scripts/sanity-leeann-quick-fixes-1111.mjs
  (dry run by default, `--apply` writes, idempotent): nationalShow, show-19-2027,
  societyEvent-15 (venue, title), showPage-01/16/17, showExhibitorInfo, showExhibitorStep-enter.

## Exceptions kept
- Ticket stub numeral XIX (lib/data/ticket-presentation.ts): a design mark.
- lib/show-identity.ts still renders "19th" from the Sanity edition number.
- plan-your-visit parking line (and Sanity showVisitorInfo.gettingThereIntro): her verbatim copy.
- "R44 northbound to Stellenbosch" is her wording, kept.

## Open questions
- Plan Your Visit doc still says Flying Club (modified 2026-10-24): update, and is the R44 approach right?
- What should the ticket stub show in place of the XIX numeral?
- Replace "19th" in the hero CTA, show band and countdown (touches closed contracts)?
- Reword FAQ answers that mention international guests (showFaq-q8, q32)?
- Deferred: vendors page split, one entry form, mirroring copy into her Drive docs.
