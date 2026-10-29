# For SAOC: Sanity-held and SAOC-lane strings (NOS Site writes none of these)

Proposed wording uses only Brad's terms (goldens/source-council-thread.md). Sentence-level swaps marked D3/D2 are DECISION NEEDED items in spec.md; confirm before writing to Sanity.

| # | where | now | proposed |
|---|---|---|---|
| S1 | Sanity `showFaq-q25` answer (FAQ "Will the orchids be judged?") | "...recognising outstanding orchids and exhibitors." | "...recognising outstanding orchids." (D3) |
| S2 | Sanity `showFaq-q28` question and answer | "When can exhibitors set up their displays?" / "The specific exhibitor setup, judging, ..." | "When can Display Exhibitors set up their displays?" / "The specific Display Exhibitor setup, judging, ..." (D2) |
| S3 | `sanity/schemas/documents/ticketType.ts:145` Studio option title (value `exhibitor-entry` must not change) | `Exhibitor Entry` | title only, e.g. `Award Entry` (D8); not shown on any NOS page |
| S4 | showPage `01-national-show-landing` (seed `content/show-pages/01-national-show-landing.json:36`) | "...Workshops, Exhibitors, Sponsors..." names the page that was Exhibitors | "...Workshops, Award Entries, Sponsors..." |
| S5 | `scripts/seed-show-faq.ts:281,303,305` | q25 sentence, q28 question and answer | EDITED IN OUR PR (audit R35, R45, R46); SAOC runs the seed/Sanity write for S1-S4 after NOS Design signs off and the PR merges |
| S6 | `app/(marketing)/about/page.tsx:159` (SAOC host) | "...growers, exhibitors, breeders, judges..." | SAOC to decide whether this means plant entrants |
| S7 | Sanity `ticketsPage.ticketIncludesNote` | "...and entry to all exhibitor stages." | no wording proposed (D9): the retired exhibitor-stages concept does not say which kind of exhibitor |
| S8 | `app/(nos)/national-show/sponsors/page.tsx:60`, `components/sponsors/*` | "Exhibitors and vendors" (class b, correct) | no change; listed because the files are SAOC's |
| S9 | Elbert Wijaya bio, Sanity `conferencePresenter-elbert-wijaya` | "...blue-flowered Dendrobium species and Papilionanthe tricuspidata, a species once thought to be extinct." | Lee-Ann's updated Drive text, see goldens/elbert-bio-diff.md |

Kept as correct (class b, no action): showFaq-q1, q8, q32; international presenter bios that mention having exhibited.

After SAOC changes S1/S2 the NOS gate (gate-render.mjs content) prints NOTE lines for the Sanity-held rows; they turn from "still rendered" to "not rendered" once the fixture is re-captured.

| S10 | Any Sanity portable-text link or CMS field pointing at `/exhibitors` or `/national-show/exhibitors` | old path | `/award-entries` (the 308 keeps old links working, but repoint them) |
