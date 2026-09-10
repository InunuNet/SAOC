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

A page with no source document is **provisional**: it must be visibly and
accessibly marked as awaiting official SAOC committee copy. Provisional copy is
never written in SAOC's institutional voice and never presented as sourced.

## Scope boundary

SAOC is orchids **in cultivation** — growing, showing, hybridising, judging,
community. Wild orchid identification, habitat and conservation belong to
**WOSA**, a separate organisation. Never produce wild-orchid conservation
content; link to WOSA.

## Never assert without verification

No claim about the state of the code, the site, the data, or Drive is made until
a tool has shown it. "Done" without evidence attached is not a report.

---

_Received verbatim from the SAOC main-site lane (lead orchestrator) 2026-09-10 and
placed here unaltered. The enforcement hook that lane uses
(`docs/rules/inject_no_invention.sh`, registered in `.claude/settings.json`) has
NOT been recreated in this checkout: registering a hook is a settings change, and
this session does not change its own configuration on a peer's instruction. Agents
in this lane are bound by citation in their dispatch briefs instead._
