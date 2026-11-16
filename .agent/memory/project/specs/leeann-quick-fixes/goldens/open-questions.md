# Follow-ups and questions (not done by this contract)

For Lee-Ann (post in her Questions doc, dated block, via gws):
1. Plan Your Visit doc still says "Stellenbosch Flying Club" in the parking line and the "show is held at the hangar" sentence (file modified 2026-10-24, before her Hangar 25 answer). Should both now read Hangar 25, Orca Aero Solutions, Stellenbosch Airfield? And is "R44 northbound to Stellenbosch" still the correct approach for that venue?
2. Ticket stub shows the large numeral "XIX" and caption "19th Show" (Symposium and WOSA Conference tickets, also on the PDF). A long phrase will not fit a numeral slot: what should the stub show? (NOS Design to propose.)
3. Home page hero CTA, show band and countdown still say "19th National Show" because they read the show's edition number (19) from Sanity. Replace with "National Orchid Show - Western Cape 2027" everywhere? (Brad's call; touches closed contracts.)
4. FAQ answers mention "international guests and exhibitors" (showFaq-q8, q32): reword now that the International guests page is gone?

Deferred (separate work, explicitly out of this batch):
- Vendors page restructure into two sections (Vendor application and information; public vendor list).
- One entry form (no separate SHOW ENTRY and SAOC Entry).
- Drive source docs: mirror the copy changes into Lee-Ann's source docs with a comment (feedback_drive_copy_mirrors_site).

# Known drift (closed contracts, not edited)
- `contracts/golden/show-exhibitor-info/seed-show-exhibitor-info.golden.json` (older closed contract) still holds the "19th" exhibitor-info text; the patched seed `scripts/seed-show-exhibitor-info.ts` now reads "National Orchid Show - Western Cape 2027". Same for `contracts/golden/f5-event-slugs/expected-slugs.golden.json` (old societyEvent title; slug unchanged).
