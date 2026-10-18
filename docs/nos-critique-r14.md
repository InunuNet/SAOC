# nos-critique-r14

## F1 - one section unit between adjacent full sections on the tickets hub (Codi ruling 3)

Codi's ruling 3 (FINAL, 2026-10-18): on the tickets hub, an `nk-section` followed by another full
section showed a dead band (230px at 1280, 144px at 390) between Day tickets and Show passes. The
fix is one section unit between full sections: the bottom padding of one or the top padding of the
next, not both.

- Cause: `.nk-section` and `.nos-theme .nos-section` both carry
  `padding-block: clamp(72px, 9vw, 120px)`, so two adjacent sections stacked the leader's
  padding-bottom on the follower's padding-top.
- Fix: one additive rule in `app/(marketing)/national-show/nos-structure.css`, placed directly
  after the r12 F6 rules. It sets `padding-top: 0` on a full section (`.nk-section` or
  `.nos-section`) that follows an `.nk-section` inside the hub's `.nos-theme`. The gap is then the
  leader's padding-bottom alone: 115.2px at 1280 and 72px at 375, 390 and 768.
- Scope: the hub is the only route whose `.nos-theme` holds the `.nk-masthead` (TicketsMasthead),
  and the selector is keyed on that. It covers #thursday -> #passes, #passes -> #programme and
  #programme -> the foot options section. The masthead -> #thursday join is a ground change, not a
  pair, and is untouched.
- The r12 F6 rules for disclosure-ending sections (40px) are unchanged. No new token, length or
  copy.

## F2 - /societies gets its own meta description (lead ruling (a))

Under the lead's ruling (a) (FINAL, 2026-10-18), /societies stops falling through to the root
layout's site default description. It uses this sentence verbatim:

> The SAOC also provides a national forum through which affiliated societies can collaborate and
> share expertise.

- Source: Lee-Ann's Drive,
  `content/drive-source/SAOC /2. About/About page - South African Orchid Council/v1.0/content.md`
  line 9, its last sentence (no-invention source 1).
- `app/(marketing)/societies/page.tsx` builds its metadata with `buildPageMetadata` (`lib/seo.ts`),
  the same way /about does. The string is 111 chars, inside the 70-160 bounds, so `fitDescription`
  keeps it as written. The title stays 'Affiliated Societies'. A one-line comment cites the Drive
  path and line.
- `buildPageMetadata` also emits the self-canonical and the og and twitter tags, the helper's
  documented contract.
- `UNSOURCED_LEDE` and its withhold-on-public branch are unchanged.
- The root layout's Organization JSON-LD description is site-wide organisation data, not a page
  description, so it keeps the default (lead ruling).
- r12's "/societies keeps the default" pins are amended by this ruling and recorded in
  `.agent/memory/project/specs/nos-critique-r14/goldens/supersession.json`.
