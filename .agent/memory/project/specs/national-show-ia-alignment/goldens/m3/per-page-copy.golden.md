# Golden — the per-page section plan (M3)

Section plan for the 15 pages M3 writes. @dev authors bodies against this; the sectionKeys,
provenance values and prohibitions are binding, the exact sentences are not.

**The arithmetic, and a correction to a number we adopted.** 17 documents; entries **2** and
**13** carry real council copy and M3 does not touch them; the remaining **15 carry the
disclosure**. Codi's "15" is right, their reason was not — they had entry 1 as having real
copy. It does not: `/national-show/page.tsx`'s existing copy is code-authored by us, never
supplied by the council, so entry 1 is `placeholder-ai` like the rest. Same number, different
page.

Rules for every row below: `copy-authoring.golden.md`. No dates, times, prices, personal or
business names, contact details or counts. Where a page needs one, the sentence says it is
not yet confirmed.

## F9 — the ten entries with no copy at all

| spec | pageKey | sections (`sectionKey` — provenance) | must not contain |
|---|---|---|---|
| 1 | `01-national-show-landing` | `welcome` — placeholder-ai · `what-is-on` — placeholder-ai · `getting-here` — research (venue only, verbatim) | show dates; a "news" block with invented items |
| 5 | `05-international-guests-and-exhibitors` | `intro` — placeholder-ai · `who-will-appear` — placeholder-ai | any guest name, country attribution, or session claim |
| 7 | `07-wosa-conference` | `about-the-conference` — placeholder-ai · `attending` — placeholder-ai · `about-wosa` — placeholder-ai (links out, describes nothing) | species, habitat, conservation status, abstracts, speaker names — W1/W2/C7 |
| 8 | `08-judging-and-awards` | `intro` — placeholder-ai · `how-judging-works` — placeholder-ai · **results rendered from `award`/`judge`, not prose** | invented award names, judge names, or results |
| 9 | `09-plant-exhibition-and-sales` | `intro` — placeholder-ai · `visiting` — placeholder-ai · `accessibility` — placeholder-ai | opening hours, admission prices, parking specifics |
| 10 | `10-plant-sales` | `intro` — placeholder-ai · `buying-and-taking-plants-home` — placeholder-ai · `payment` — placeholder-ai | nursery names; a claim that cards or an ATM will be available |
| 11 | `11-programme` | `intro` — placeholder-ai · `how-the-programme-will-work` — placeholder-ai | any session, time, day allocation or speaker |
| 12 | `12-workshops` | `intro` — placeholder-ai · `what-to-expect` — placeholder-ai · `booking` — placeholder-ai (links to the live flow) | workshop titles, prices, durations, capacities, presenters |
| 15 | `15-sponsors` | `intro` — placeholder-ai · **listing rendered from `sponsor`, not prose** | any sponsor name or tier attribution |
| 16 | `16-plan-your-visit` | `intro` — placeholder-ai · `getting-here` — research (venue verbatim) · `staying-nearby` — placeholder-ai | accommodation names, distances, travel times, prices |

**Entries 8 and 15 are not prose-for-now.** `sponsor`, `award` and `judge` exist today with
live queries (`sanity/queries.ts:298,329,429`). Their listings render from real data — empty
until records exist, with an honest "to be announced" — beside a placeholder-marked intro. A
prose page *about* sponsors is one sentence from inventing one, and an invented sponsor is an
invented relationship with a real business. See `copy-authoring.golden.md` §5.

## F10 — the five thin entries needing gap-fill

Existing council text is **not touched, not merged into, and not paraphrased**. New material
goes in **separate sections** so the council's words keep `council-supplied` and ours never
inherit it.

| spec | pageKey | existing (untouched) | M3 adds |
|---|---|---|---|
| 3 | `03-what-to-expect` | her marketing prose — `council-supplied` | `visitor-logistics` — placeholder-ai. Spec 4.3 asks this page for hours, parking, photography policy, cloakroom, accessibility; none were supplied. Each is named as a heading with "to be confirmed", never an invented value. |
| 4 | `04-south-african-exhibitors` | intro + her field model — `council-supplied` | `directory-coming` — placeholder-ai, one short section saying the directory is being compiled. No exhibitor names. |
| 6 | `06-saoc-symposium` | the theme statement — `council-supplied`, verbatim | `about-the-symposium` — placeholder-ai · `attending` — placeholder-ai. No programme, no speakers. |
| 17 | `17-faq` | two recovered Q&As — `council-supplied` | `more-questions-coming` — placeholder-ai. **The recovered source is truncated upstream** and Lee-Ann's own note asks for more questions; say that plainly rather than inventing answers. |
| 18 | `18-contact-us` | her stub — `council-supplied` | `how-to-reach-us` — placeholder-ai. **Departmental routing is an open question she is still asking** (spec 4.18) — the section says enquiries routing is being finalised. No email addresses. |

## Two sentences that must appear verbatim

Both are council-supplied and held in `content/drive-recovered/`. Reproduce
character-for-character; D6 pins the first, and it has already been paraphrased once.

- **Venue:** `Stellenbosch Flying Club, R44 northbound to Stellenbosch`
- **Theme:** `From Wild Origins to Cultivated Excellence: The Future of Orchids`

## Section bodies: shape, not length

Two to four short paragraphs per section. Long enough that the page does not look broken,
short enough that it is obviously a draft. The placeholder notice does the disclosure work —
the copy does not need to apologise for itself in every paragraph.

Each section's first sentence says what the page is for, drawn from that entry's spec
Section 4 **Purpose** line. That gives Lee-Ann something recognisable to react to, which is
the whole point of a draft.

## What this plan does not settle

- **Whether the copy is any good.** These are constraints, not a brief. A human reads it
  before launch.
- **Entry 1's relationship to the existing landing page.** `/national-show/page.tsx` already
  has code-authored copy. Whether M4 replaces it with these sections, keeps it and adds them,
  or merges the two is an **M4 decision** — it is page structure, not content, and it is
  flagged rather than assumed here.
- **Entries 3, 16 and 17 overlap `showVisitorInfo`**, which owns live copy on those same
  routes with its own `confirmationStatuses` markers. M4/F16 unifies the mechanism; until it
  does, those three pages have two sources and M3 must not duplicate a fact into both.
