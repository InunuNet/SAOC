# No Invention — Production Product

SAOC is a **production product for a real national body**. Nothing on it is
invented as we go. Every element on the site traces to one of exactly three
sources:

| source | covers |
|---|---|
| Lee-Ann's Drive documents | all copy, all page content, which pages exist |
| `design/design_handoff_saoc/` + `branding/` | every visual decision — tokens, type, colour, shells, components |
| Brad's explicit instruction | everything else |

**If it is not in one of those three, it does not exist yet.** The correct
response to a gap is to *name the gap and ask*, never to fill it with judgement,
inference, or a reasonable-sounding default.

## The binding design system

Approved, already in the repo, not up for revision:

- `design/design_handoff_saoc/design_system_README.md`
- `design/design_handoff_saoc/colors_and_type.css`
- `design/design_handoff_saoc/SKILL.md`
- `design/design_handoff_saoc/ui_kits/`, `.../src/`, `.../screenshots/`
- `design/Claude Design HTML/SAOC Website (standalone).html`
- `branding/SA Orchid Council/`, `branding/National Show 2027/`

Agents **implement** this handoff faithfully. No agent proposes, extends,
"improves", or reinterprets it. Site-wide chrome is SAOC; National Show branding
sits below the header on `/national-show` only.

Every `@architect`, `@dev`, and `@designer` brief cites these paths up front.

## Content provenance

Lee-Ann's Drive tree is the **content inventory and coverage contract** — it says
which pages exist and which have official committee copy. It is not a literal
folder-to-URL map; navigation and routing are engineering decisions made against
the handoff.

Provenance is tracked **per content block, not per page** — a required field
with no default. A page-level flag forces one dishonest answer across a mixed
page: `/national-show/what-to-expect` carries Lee-Ann's real marketing prose but
has no opening hours, parking, or photography policy. Flag the page and either
her words are libelled as AI-generated or the gaps are laundered as sourced.
Per-block lets her real words read as real, lets the gaps read as gaps, and lets
her clear them one at a time as she writes.

Four values, all explicit:

| value | means |
|---|---|
| `council-supplied` | Lee-Ann's finished copy |
| `council-draft` | Lee-Ann's words verbatim, where her document is unfinished |
| `research` | true, sourced elsewhere, not Council-confirmed |
| `placeholder-ai` | written by an agent, awaiting official committee copy |

`council-draft` is not optional tidiness. Its absence leaves only two moves for
unfinished Council copy: relabel her prose as AI-generated — a provenance lie —
or delete it, which is correct but discards content that had value. Her FAQ would
otherwise have published `"on xx, xx September 22027 at the xx"` as finished
Council copy with no notice: real copy that is not ready, rendering as though it
were. That is the *inverse* of the failure the mechanism was built to catch, and
every assertion written before it passed on that string. Do not simplify this
value back out.

Anything not `council-supplied` must be visibly and accessibly marked. Unsourced
copy is never written in SAOC's institutional voice and never presented as
sourced. The disclosure carries an explicit AI-generation statement and may not
be softened.

## Scope boundary

SAOC is orchids **in cultivation** — growing, showing, hybridising, judging,
community. Wild orchid identification, habitat and conservation belong to
**WOSA**, a separate organisation. Never produce wild-orchid conservation
content; link to WOSA.

## Never assert without verification

No claim about the state of the code, the site, the data, or Drive is made until
a tool has shown it. "Done" without evidence attached is not a report.
