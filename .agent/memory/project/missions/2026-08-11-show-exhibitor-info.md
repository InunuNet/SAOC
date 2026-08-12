---
schema: athanor.mission/v1
slug: show-exhibitor-info
goal: Expand the National Show exhibitor section from a generic placeholder into a
  complete entry guide — how to enter, deadlines, staging, judging, plant eligibility,
  display and sales rules — built on researched international orchid-show convention
  and fully Sanity-editable
created_at: '2026-08-11T19:40:00.000000+00:00'
started_at: null
last_active_at: '2026-08-12T09:11:59.926888+00:00'
status: done
cost_estimate:
  features: 4
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: M3
  feature: F4
  ts: '2026-08-12T09:11:59.926888+00:00'
features:
- id: F1
  title: Bake the researched exhibitor conventions into a Sanity content model
  inline_brief: 'Turn the @analyst research (international orchid-show exhibitor convention
    — see Context) into a `showExhibitorInfo` singleton plus a `showExhibitorStep`
    or equivalent repeatable type. Cover: entry process and deadlines, entry fees,
    staging/delivery/removal times, schedule of classes, judging (timing, whether
    exhibitors may attend, standards, awards), plant eligibility (ownership duration,
    pest/disease inspection, labelling and nomenclature), display/stand rules, sales
    and permits, insurance/security/ watering/loading. Seed create-if-absent ONLY
    — never createOrReplace. Every value SAOC has not confirmed carries a visible
    "To be confirmed by the show committee" marker; the seeded text is researched
    international convention, a starting point for the committee to correct, and must
    never read as SAOC policy already decided.'
  status: done
  milestone: M1
  completed_at: '2026-08-12T09:11:59.250118+00:00'
- id: F2
  title: Rebuild /national-show/exhibitors as a real entry guide
  inline_brief: 'Replace the current 108-line generic placeholder ("Full details coming
    2026") with a structured, Sanity-driven guide covering everything in F1, ordered
    the way an exhibitor actually experiences it: decide to enter → enter by the deadline
    → prepare and label plants → deliver and stage → judging → show days → removal.
    Keep it scannable — an exhibitor is checking a deadline, not reading an essay.'
  status: done
  milestone: M2
  completed_at: '2026-08-12T09:11:59.447157+00:00'
- id: F3
  title: Exhibitor key-dates block and downloadable entry form
  inline_brief: 'A prominent dates/deadlines summary (entry closes, staging, judging,
    show days, removal) driven from Sanity so the committee can adjust without a developer.
    Provide an entry-form route: prefer linking a committee-supplied PDF stored in
    Sanity over building a submission form — the council has not asked for online
    entry and it would need its own data handling. If no file exists, render an honest
    "entry form to be published" state, never a dead link.'
  status: done
  milestone: M2
  completed_at: '2026-08-12T09:11:59.718007+00:00'
- id: F4
  title: Make it reachable and cross-linked
  inline_brief: 'Link the exhibitor guide from the show landing page and site nav.
    Cross-link to /judging (SAOC judging standards already exist there) and to the
    show classes already rendered on the landing page — do not duplicate either. Same
    reachability rule as the visitor mission: built and unreachable is not built.
    Reconcile with `nationalShow.exhibitorStages` (existing portable-text field) —
    either use it or retire it, do not leave two overlapping sources.'
  status: done
  milestone: M3
  completed_at: '2026-08-12T09:11:59.926706+00:00'
milestones:
- id: M1
  title: The exhibitor content model exists, seeded with researched convention
  features:
  - F1
  status: done
  gate_ran_at: '2026-08-12T09:12:35.423746+00:00'
  gate_result: pass
- id: M2
  title: An exhibitor can find out exactly what to do and by when
  features:
  - F2
  - F3
  status: done
  gate_ran_at: '2026-08-12T09:12:35.648198+00:00'
  gate_result: pass
- id: M3
  title: The guide is reachable and does not duplicate existing content
  features:
  - F4
  status: done
  gate_ran_at: '2026-08-12T09:12:35.845836+00:00'
  gate_result: pass
---








# Mission: National Show exhibitor information

## Context

**Brad's directive, 2026-08-11.** Paired with `show-visitor-info`. The exhibitor page is a generic
placeholder; exhibitors are the people who actually make the show. Brad: "Orchid shows happen all
over the world. Let's just nail down the defaults from a bunch of searches using Alembic and bake
that in."

**The approach is the point.** Do not invent SAOC's exhibitor rules. Orchid shows have decades of
established international convention — entry deadlines, staging windows, ownership-duration rules,
pest inspection, labelling and nomenclature standards. Research those defaults, seed them as a
CLEARLY-LABELLED starting point, and let the committee correct rather than compose from a blank
page. This is the same posture as the ticketing prices: honest placeholders beat plausible
invention, because it goes in front of the council.

**Research input:** @analyst (`EXH-RESEARCH`, 2026-08-11) surveyed World Orchid Conference, AOS
judged shows, RHS, Australian Orchid Council, Singapore/Taiwan international shows and any SA
precedent, via Alembic. Its findings — which conventions are near-universal versus one-off local
practice — are the source for F1's seeded content. **Re-read that report before starting F1**; if
it is not on disk, re-run the research rather than guessing.

### Scope discipline

- **SAOC is orchids IN CULTIVATION** — growing, showing, hybridising, judging. Wild-orchid
  conservation is WOSA's. Anything touching indigenous habitat or fieldwork links to
  `wildorchids.co.za` and is not described here.
- **Flag SA-specific divergence.** CITES, provincial plant-movement rules and indigenous-species
  restrictions may not follow international practice. Where the research flags a likely SA
  difference, seed it as an explicit question for the committee, not as a stated rule.
- **Never state a rule as SAOC policy that SAOC has not confirmed.** An exhibitor turned away at
  staging because our page invented a deadline is a real harm to a real person.
- **No online entry submission** unless the council asks for it — out of scope, needs its own
  data-handling decision. Link a committee-supplied form instead.
- **No new brand assets, colours or fonts.** Sage & Paper tokens only.

### What already exists

- `app/(marketing)/national-show/exhibitors/page.tsx` — 108 lines, real but generic
  ("Full details coming 2026"). Not the filterable exhibitor database that spec §4.4 describes;
  that database remains out of scope and unpriced.
- `sanity/schemas/documents/nationalShow.ts` — `exhibitorStages` portable-text field already
  exists. F4 must reconcile it with the new model rather than leaving two overlapping sources.
- `/judging` — SAOC judging standards already live here. Cross-link, never duplicate.
- Show classes already render on the show landing page. Same rule.

### Content needed from Lee-Ann / the committee

Entry deadline and fees; staging and removal times; whether exhibitors may attend judging; plant
ownership-duration rule; whether exhibitors may sell and on what terms; insurance and overnight
security arrangements; the entry form itself. Until supplied, each renders as a labelled
placeholder over the researched default. Add to the call-prep doc.

## Notes

- Commercial context carries over from `show-visitor-info`: spec §4 describes an 18-page show
  section, the accepted proposal priced a single show hub landing page. This mission, like its
  sibling, is a deliberate middle path.
- Sequence after `show-visitor-info` — it establishes the section's page patterns, and F1 there
  may create schema conventions worth following here.
