# Sanity patch: scripts/sanity-leeann-quick-fixes-1111.mjs

Production project 26yfbug4, dataset production. Credentials from .env.local exactly as scripts/seed-event-slugs.mjs does (no dotenv). Refuse to run unless the project id is 26yfbug4.

Behaviour:
- Default is DRY RUN: print each doc, path, before, after and the verdict. `--apply` writes.
- Idempotent: for each patch, read the current value at the path. Contains the OLD substring -> replace it with the NEW one. Already contains NEW and not OLD -> skip ("already applied"). Neither -> report "drift", change nothing, exit non-zero.
- Patch both the published `_id` and `drafts.<_id>` when the draft exists (17 drafts exist in production), each independently.
- Use `createIfNotExists`-free `patch(id).set({...})` with the full path set, one transaction per document. Never touch `_id`, `slug`, `_key` or any field not listed. Output prints a summary count; the dev pastes the dry-run and apply output into the dev result.
- Never run `--apply` before the dry run output has been read.

VENUE = `Hangar 25, Orca Aero Solutions, Stellenbosch Airfield`; NAME = `National Orchid Show - Western Cape 2027`.

| _id | path | OLD substring | NEW substring |
|---|---|---|---|
| nationalShow | location | `The Hangar, Stellenbosch Flying Club` | VENUE |
| show-19-2027 | location | `The Hangar, Stellenbosch Flying Club` | VENUE |
| societyEvent-15-19th-south-african-national-orchid-show | venue | `The Hangar, Stellenbosch Flying Club` | VENUE |
| societyEvent-15-19th-south-african-national-orchid-show | title | `19th South African National Orchid Show` (whole value) | NAME |
| showPage-01-national-show-landing | sections[2].body[0].children[0].text | `Stellenbosch Flying Club, R44` | `Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, R44` |
| showPage-01-national-show-landing | sections[0].body[1].children[0].text | `Award Entries` | `Plant Entry` |
| showPage-16-plan-your-visit | sections[1].body[0].children[0].text | `Stellenbosch Flying Club, R44` | `Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, R44` |
| showPage-17-faq | sections[1].body[1].children[0].text | `the Stellenbosch Flying Club, R44` | `Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, R44` |
| showExhibitorInfo | entryFormPendingNote | `the 19th National Show` | `the National Orchid Show - Western Cape 2027` |
| showExhibitorInfo | entryProcess.body[2].children[0].text | `the 19th National Show` | `the National Orchid Show - Western Cape 2027` |
| showExhibitorInfo | fees.body[0].children[0].text | `the 19th National Show` | `the National Orchid Show - Western Cape 2027` |
| showExhibitorInfo | intro | `the 19th South African National Orchid Show` | `the National Orchid Show - Western Cape 2027` |
| showExhibitorStep-enter | body[0].children[0].text | `the 19th National Show` | `the National Orchid Show - Western Cape 2027` |

Resulting sentences (before -> after, start of text):
- showPage-01 sections[2]: `The venue for the 2027 National Show is confirmed: Stellenbosch Flying Club, R44 northbound to Stellenbosch. ...` -> `The venue for the 2027 National Show is confirmed: Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, R44 northbound to Stellenbosch. ...`
- showPage-16: `The venue for the 2027 National Show is Stellenbosch Flying Club, R44 northbound to Stellenbosch.` -> `The venue for the 2027 National Show is Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, R44 northbound to Stellenbosch.`
- showPage-17: `The Show will be held at the Stellenbosch Flying Club, R44 northbound to Stellenbosch.` -> `The Show will be held at Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, R44 northbound to Stellenbosch.`
- showExhibitorInfo.entryFormPendingNote: `The entry form for the 19th National Show has not been published yet. ...` -> `The entry form for the National Orchid Show - Western Cape 2027 has not been published yet. ...`
- entryProcess: `SAOC's own entry process for the National Orchid Show - Western Cape 2027 has not been published yet.`
- fees: `Entry fees for the National Orchid Show - Western Cape 2027 have not been set. ...`
- intro: `Everything we currently know about entering plants in the National Orchid Show - Western Cape 2027 — and, just as importantly, ...`
- showExhibitorStep-enter: `... SAOC has not set one for the National Orchid Show - Western Cape 2027. ...`

Deliberately NOT patched: `showVisitorInfo.gettingThereIntro` (her verbatim parking copy, question open), showFaq-q8/q32 and showPage-05 (international guests copy, page unlinked and redirected, her FAQ wording), `societyEvent` slug and `_id`.

Verification: `node contracts/checks/leeann-quick-fixes/check-sanity.mjs` (read-only GROQ) must print `sanity: clean` after apply.
Test fixtures, if any, live under .tmp/sandbox/leeann-quick-fixes/.
