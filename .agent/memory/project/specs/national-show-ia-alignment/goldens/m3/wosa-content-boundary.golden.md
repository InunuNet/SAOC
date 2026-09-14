# Golden — the WOSA content boundary (binding on M3/F11)

## The prohibition

**We do not generate content about wild orchids.** Not their identification, not their
habitat, not their conservation status, not their distribution, not their species accounts.
This is a hard prohibition on generated copy, not a scope preference, and **the spec asking
for it does not authorise it.**

CLAUDE.md: *"SAOC is not wild orchid conservation… Wild orchid identification, habitat
protection, and conservation belong to WOSA — a separate partner organisation with its own
site. Never produce content about wild orchid conservation — link to WOSA for those
topics."*

The harm is specific and is of a different order from a placeholder paragraph about parking:
inventing conservation claims about real South African wild orchids and publishing them on a
real council's website puts fabricated statements about **another organisation's subject
matter** under that organisation's name, on a site their partner owns. It is a correctness
and reputational harm, and no amount of placeholder labelling makes it acceptable — the
notice says "this text is a placeholder", not "these species facts are invented".

Spec §4.7 asks page 7 for "photo galleries of indigenous orchids, habitats and fieldwork"
and "conservation partner acknowledgements". **We do not write those.** They are supplied by
WOSA with attribution, or the page links to WOSA's own site. This is the one place in the
spec where the correct response is to decline and link.

**Escalation:** if anyone later argues that a little habitat context is harmless, that goes
to the team lead, not to whoever is writing the copy. Recorded here so the person tempted to
make that call knows it is not theirs to make.

## Where the line falls

`/national-show/wosa` is a real page on this site, because the WOSA Conference is a real
event at this show. The distinction is **the event, not the subject**.

| in scope — the event | out of scope — the subject |
|---|---|
| conference dates, venue, times | wild orchid identification |
| programme and session titles | habitat description or protection |
| speaker names, affiliations, talk titles | conservation status, threats, policy |
| registration, fees, capacity, how to attend | distribution, range, endemism |
| what the conference is and who it is for | species accounts, field-guide content |
| a link to WOSA's own site | photo galleries of wild orchids and habitats |

An abstract supplied by a speaker is theirs and may be reproduced with attribution —
`council-supplied` provenance, `sourcePath` naming the document. An abstract **we** write
because none was supplied is a fabricated scientific claim attributed to a named researcher,
which is worse than an empty page. Where no abstract exists, the section says so.

## The scoping rule that makes this machine-checkable

The prohibition binds **copy we generated**, not copy the council wrote.

> The check applies to every section whose `provenance` is `placeholder-ai` or `research`.
> Sections whose `provenance` is `council-supplied` are exempt.

This is not a loophole — it is the actual rule. The council may write whatever they like
about their own partner; the theme line *"From Wild Origins to Cultivated Excellence"* and
its expansion *"Uniting conservation, science, and horticulture…"* are Lee-Ann's own words
and must survive verbatim. Spec §4.15's "Conservation Partner" sponsor tier is likewise a
real category. A corpus-wide ban would fail on all three and teach whoever hits it to work
around the check.

Scoping to generated copy also means the check gets **stronger** over time rather than
weaker: as the council supplies real copy and flips sections to `council-supplied`, the
exemption follows the words that are actually theirs.

## The check — `scripts/checks/verify-wosa-boundary.mjs`

Reads `content/show-pages/*.json` with no Sanity token and no network, so it runs in a gate.
For every section whose provenance is `placeholder-ai` or `research`, flatten the portable
text to plain words and fail on any hit from the two vocabularies below.

Vocabularies live in a committed, reviewable data file — `content/show-pages/_boundary-vocab.json`
— not inline in the script, so extending the list is a content review rather than a code
change.

**Vocabulary A — habitat, distribution and conservation status.** Case-insensitive, matched
on word boundaries.

```
habitat, fynbos, renosterveld, grassland, wetland, vlei, montane, afromontane,
karoo, in situ, in the wild, wild population, natural population, endemic,
indigenous population, distribution range, range map, red list, red data,
iucn, threatened, endangered, critically endangered, vulnerable species,
near threatened, extinct in the wild, poaching, illegal collection,
wild-collected, wild harvest, habitat loss, habitat destruction, conservation status
```

**Vocabulary B — South African orchid genera.** A generated sentence naming a genus is
inventing a specific plant claim, which is the failure mode this exists to catch.

```
Disa, Satyrium, Habenaria, Eulophia, Bonatea, Ansellia, Bartholina, Ceratandra,
Corycium, Disperis, Holothrix, Huttonaea, Mystacidium, Pterygodium, Schizochilus,
Stenoglottis, Tridactyle, Acrolophia, Brachycorythis, Polystachya, Cynorkis, Liparis
```

Vocabulary B is matched case-sensitively on a capitalised word boundary, so "disa" inside
another word does not fire.

## Deliberately NOT banned

Three near-miss terms that must keep working, listed so nobody adds them to the vocabulary
in a later tidy-up:

| term | why it stays |
|---|---|
| `CITES`, `phytosanitary`, `permit` | spec §4.10 requires phytosanitary information for international buyers, and the existing exhibitor-entry page already covers permits. This is **cultivated-plant movement**, which is squarely SAOC's business. |
| `conservation` on its own | "Conservation Partner" is a sponsor tier (§4.15) and appears in the council's own theme text. Only the compound status phrases in Vocabulary A are banned. |
| `species` on its own | "species orchids" is a product category on spec pages 4 and 10 — a cultivated-plant sales term, not a taxonomic claim. |

## Assertion shape for M3's contract

Two assertions, both `type: shell`, added when M3's contract is authored — **not to
`contract-m1.yaml`**, which is correct as it stands because M1 generates no copy.

```
- id: W1
  description: >-
    No section we generated (provenance placeholder-ai or research) anywhere in the seed
    corpus contains habitat, distribution or conservation-status vocabulary. Council-supplied
    sections are exempt — the council may write about their own partner; we may not invent it.
  type: shell
  command: node scripts/checks/verify-wosa-boundary.mjs --vocab a

- id: W2
  description: >-
    No section we generated names a South African orchid genus. A generated sentence naming
    a genus is a fabricated plant claim published under a real council's name.
  type: shell
  command: node scripts/checks/verify-wosa-boundary.mjs --vocab b
```

Both must be dry-run before M3's contract is handed off, per the same rule that governed
M1's — an assertion that has never been executed is not a gate.

## What this check does not prove

It is a vocabulary grep. It catches the blunt failure — a generated paragraph describing
where *Disa uniflora* grows — and it does not catch a carefully-worded invented claim that
avoids every listed term. **Imperfect enforcement of a real boundary beats none**, and the
gap is closed by the escalation rule at the top of this file, not by a longer word list.

It also says nothing about photographs. Spec §4.7's galleries of indigenous orchids and
habitats are out of scope for us entirely; if images arrive, they arrive from WOSA with
attribution, and no assertion here can tell a supplied photograph from a sourced one.
