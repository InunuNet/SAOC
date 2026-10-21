# Golden: F3 notice matrix (condition 3)

These are the expected notice kinds for every section, through the real `resolveNotice()` with no settings (fallback labels). They hold after F3, for both the seed corpus and the published dataset.
- `none` = no notice: council-supplied, and linked to an existing recovered source.
- `placeholder` = "Placeholder copy".
- `research` = "Not yet confirmed".
- `draft` = "Council draft".

A **gated route** is one that renders the page through `loadShowPageOrFallback`.

| pageKey | gated route | section → expected notice |
|---|---|---|
| 01-national-show-landing | — | welcome → placeholder · what-is-on → placeholder · getting-here → research |
| 02-about-the-national-show | — | **overview → none** (was placeholder) |
| 03-what-to-expect | — | **overview → none** (was placeholder) · visitor-logistics → placeholder |
| 04-south-african-exhibitors | /national-show/sa-exhibitors | **overview → none** (was placeholder) · directory-coming → placeholder |
| 05-international-guests-and-exhibitors | /national-show/international-guests | intro → placeholder · who-will-appear → placeholder |
| 06-saoc-symposium | /national-show/symposium | theme → none · about-the-symposium → placeholder · attending → placeholder |
| 07-wosa-conference | /national-show/wosa-conference | about-the-conference, attending, about-wosa → placeholder |
| 11-programme | /national-show/programme | intro, how-the-programme-will-work → placeholder |
| 12-workshops | — | intro, what-to-expect, booking → placeholder |
| 13-booking-tickets | — | categories → placeholder |
| 15-sponsors | /national-show/sponsors | intro → placeholder · listing (entityList) → placeholder |
| 16-plan-your-visit | — | intro → placeholder · getting-here → research · staying-nearby → placeholder |
| 17-faq | — | faq-q1-symposium-date → draft · faq → none · more-questions-coming → placeholder |

**Rows with a recovered source that still show a notice, and why that is correct:**
- **13/categories.** The source is `content/drive-recovered/13-booking-tickets/ticketing/content.md`, but the provenance is `placeholder-ai`. The section is AI-written copy that was *informed by* the council's ticketing doc, so the placeholder notice is honest.
- **01/getting-here** and **16/getting-here** are provenance `research` against the recovered FAQ, so the research notice is honest.
- **17/faq-q1-symposium-date** is a `council-draft`, so the draft notice is honest.

Condition 3's "no placeholder for content with a recovered source" applies to the council claims (`council-supplied`/`council-draft`) that a recovered source backs. A `placeholder-ai` claim is never suppressed.

**Genuinely unsourced sections that must keep the placeholder notice:** every `placeholder-ai` row above, plus the six synthetic negatives in `f3-recovery.md` §5.
