# Golden — rules for writing the placeholder copy (M3)

M3 is the milestone with real risk in it. We are writing words that will sit on a real
council's public website, under their name, for months. Every rule below exists because a
specific way of getting that wrong is worse than an obviously-unwritten page.

**The governing principle:** an obviously-unwritten page costs the council a little
credibility. A plausible-looking page containing an invented opening time, an invented
nursery, or an invented conservation claim costs a visitor a wasted trip, a real business
its reputation, or the council a factual error attributed to them. **Placeholder copy is
allowed to be thin. It is not allowed to be wrong.**

## 1. Provenance — never `council-supplied`

Every section M3 writes carries `provenance: placeholder-ai`, or `research` where the
content is genuinely derived from a real source (Lee-Ann's spec Section 4 counts as a
source for *what the page will cover*, never for *facts*).

**No section M3 authors may be `council-supplied`.** That value means the council wrote these
words. If we write them, they did not. Assertion C1.

The practical consequence: every page M3 touches renders the placeholder notice. That is the
intended outcome, not a side effect.

## 2. No facts of record — the rule that matters most

**Never state anything a visitor could act on and be wrong.** Specifically, generated copy
contains no:

| category | why |
|---|---|
| dates | the show dates are not confirmed — Lee-Ann's own FAQ draft reads *"xx, xx September 22027"* |
| times of day | an invented opening time sends someone to a locked gate |
| prices | not finalised (spec 2.7, her own reply); P6 blocks them |
| personal names, honorifics, titles | attributing a talk or a role to a named person who has not agreed |
| business or nursery names | naming an exhibitor who is not confirmed, or does not exist |
| phone numbers, email addresses, postal addresses | actionable, and POPIA-relevant |
| capacity, counts, measurements | "over 200 growers" is a claim, not a placeholder |

Where a page genuinely needs one of these, **the sentence says it is not yet confirmed.**
"Opening times will be confirmed closer to the show" is a good placeholder sentence.
"Doors open at 09:00" is a defect. Assertions C2, C3.

**Two facts may be stated**, because the council supplied them and they are held verbatim in
`content/drive-recovered/`: the venue (*Stellenbosch Flying Club, R44 northbound to
Stellenbosch*) and the theme (*From Wild Origins to Cultivated Excellence: The Future of
Orchids*). Reproduce them **exactly** — assertion D6 pins the venue sentence, and a
paraphrase has already damaged it once.

## 3. Write from her Section 4, and no further

Each page's brief is its own spec Section 4 entry: Purpose, Key content, Key functionality,
Recommendation. Placeholder copy should read as **a plausible draft of what that page will
say** — not lorem ipsum, and not invention beyond what the spec implies.

The test: could Lee-Ann read this paragraph and recognise it as a reasonable first attempt at
the page she asked for? If it contains something she never mentioned, it is invention. If it
is unreadable filler, it is not doing the job either.

## 4. The WOSA boundary is binding here

`wosa-content-boundary.golden.md`, in full. Entry 7 carries conference logistics only — no
wild orchid identification, habitat, distribution, conservation status or species accounts,
and **no fabricated abstracts attributed to named people**. An abstract we write because none
was supplied is a fabricated scientific claim under a real researcher's name, which is worse
than an empty section. Assertions W1, W2, C7.

This is the one place the spec asks for something we decline to write. Spec 4.7 wants photo
galleries of indigenous orchids and habitats; those come from WOSA with attribution, or the
page links to WOSA.

## 5. Prose-for-now on the entity pages — and a correction to the blanket rule

Spec pages 4, 5, 8, 11, 12 and 15 are collections of entities, not prose pages. M2 (deferred)
adds the entity types. M3/M4 render them as `prose` sections meanwhile, using the `kind` M1
already implements, with the reserved `entityList`/`programme` kinds left unimplemented.

**Record for anyone reading later: this is the interim shape, not the intended one.** M2
replaces these bodies with entity-backed rendering. Nobody should mistake a paragraph
describing the exhibitor directory for a decision that the exhibitor directory is prose.

**The correction — two of the six should not be prose-for-now.** `sponsor`, `award` and
`judge` already exist as document types with live GROQ queries
(`sanity/queries.ts:298,329,429`). They are not waiting on M2, which was only ever going to
add `showExhibitorProfile`, `showGuestProfile` and `showSession`.

| page | prose-for-now? | why |
|---|---|---|
| 4 South African Exhibitors | yes | needs `showExhibitorProfile` (M2) |
| 5 International Guests | yes | needs `showGuestProfile` (M2) |
| 11 Programme | yes | needs `showSession` (M2) |
| 12 Workshops | yes | needs `showSession` (M2) |
| **8 Judging & Awards** | **no — render from `award` + `judge`** | types and queries exist today |
| **15 Sponsors** | **no — render from `sponsor`** | type and query exist today |

For 8 and 15 the honest shape is a real, possibly-empty listing plus a placeholder-marked
intro — not a paragraph *describing* sponsors we have not named. A prose page about sponsors
is one sentence away from inventing a sponsor, and an invented sponsor is an invented
relationship with a real business. Rendering an empty list marked "sponsors will be announced"
carries no such risk and needs no new schema.

Escalated to the team lead rather than assumed. If they prefer uniform prose across all six,
that is their call — but the risk is not uniform across the six.

## 6. Client source documents can contain secrets

**Codex found live email passwords in Lee-Ann's spec document**, committed and pushed to the
public repo since 2026-09-06 (two accounts, one file). Brad is handling rotation; no agent
action, no history rewriting.

The design lesson is M3's, because M3 lifts text from her Drive into tracked files:

> **Anything copied from a client source document into a tracked file is scanned before it
> lands.** Not after review, not on commit — before the copy is written.

Assertion C4 scans everything M3 adds (`content/show-pages/**`,
`content/drive-recovered/**`) for credential-shaped strings. It deliberately does **not**
scan `content/drive-source/**`: that tree is the sync tool's output and already contains the
known exposure, so an assertion over it would fail the gate on a pre-existing condition
someone else is remediating. That is a scoping decision, not an oversight — and the moment
Brad's remediation lands, extending C4 to cover `drive-source` is the right follow-up.

**Practical rule when quoting her documents:** quote the sentence you need, never a whole
block "for context". The passwords were in a part of the document nobody needed.

## 7. What none of these rules prevent

Stated at the strength they actually have, per the standing rule in `backlog.md`:

- **C2/C3 are pattern checks.** They catch a time, a price, an email, a date. They do not
  catch an invented claim written in plain prose — "the venue is a short walk from the
  station" is false, actionable, and matches no pattern. Only review catches that.
- **The proper-noun allowlist (C3) will produce false positives.** When it fires on a
  legitimate name, the fix is to **add the name to the allowlist**, never to reword the
  sentence. Same lever as the route allowlist in P6, and written here for the same reason:
  the next person will hit it.
- **Nothing verifies the copy is any good.** These rules keep it from being harmful. Whether
  it reads as a plausible draft of the page Lee-Ann asked for is a judgement, and it belongs
  to a human reading it before launch.
- **C4 is a credential-pattern scan**, not a secret detector. It finds a labelled password. It
  will not find an unlabelled API key that looks like ordinary text.
