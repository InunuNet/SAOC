# Mission — Menu System (Layout 4)

Opened 2026-09-10. Owner lane: NOS site lane (`saocnosdesign-56`, branch `nos-site`),
delegated by Brad. Lead lane (this session) holds the contract and the gate.

## Approved design

Brad approved **Layout 4** on 2026-09-10 from artifact
https://claude.ai/code/artifact/b9eadbd4-e165-4de9-884d-86acc9fbf2a2 —
full-width sheet under the header, five tracks:

| track | content |
|---|---|
| lead block | section eyebrow, `19th SAOC National Orchid Show` serif lead, venue + dates line, then **The Show** group (Tickets / Show Sponsors / Past Shows) folded underneath |
| column 2 | **Visit** — 4 links |
| column 3 | **Programme** — 5 links |
| column 4 | **Exhibit & Trade** — 4 links |
| feature rail | bone panel: date meta, `Tickets` serif heading, one-line blurb, primary `Buy tickets` button |

Accepted trade-off, stated to Brad before approval: the lead block and feature rail
consume two groups' width, so "The Show" folds into the lead column rather than
getting its own.

This is a **layout** approval. No new colours, faces, spacing or components — the
chrome, lockup, type and palette stay exactly as
`design/design_handoff_saoc/` defines them. Nothing here authorises design work.

## Scope

### A. Chrome (shared repo, `main` via PR)
1. `components/chrome/nav-config.ts` — restructure. Ten top-level items collapse to
   seven plus the Contact button: About / Societies / Judging & Awards / Events /
   Members / **National Show** (single `mega`) / Sponsors. All 17 listed Show routes
   move inside the one mega, in the manifest's four groups and manifest order.
   Requires a `lead` + `feature` shape the current `NavItem` union has no room for.
2. `components/chrome/MegaMenu.tsx` — today renders one narrow anchored panel with
   n columns. Becomes the full-width sheet: lead track, group tracks, feature rail.
   Keep the existing disclosure semantics verbatim (`aria-haspopup`, `aria-expanded`,
   Escape returns focus to the trigger, outside-click close, blur close). They are
   correct and were not part of what Brad reviewed.
3. `components/chrome/MobileMenu.tsx` — drawer carries the feature block at the top of
   the expanded National Show section, then the four groups as headed lists.
4. `components/chrome/Header.tsx` — only as far as the nav restructure forces.

### B. Routes (`nos-site`)
Six manifest routes have no directory on `main` and would be 404s behind the new flyout:

    /national-show/programme
    /national-show/symposium
    /national-show/wosa
    /national-show/sa-exhibitors
    /national-show/international-guests
    /national-show/sponsors

They ship with the project's established honest-gap treatment where Lee-Ann has
supplied no copy — a visible "awaiting official SAOC committee copy" marker, never
invented institutional prose (`docs/rules/no-invention.md`).

### C. Dead targets this mission closes
`nav-config.ts` currently points at two routes that do not exist. The manifest
supersedes both: `/national-show/wosa-conference` → `/national-show/wosa`,
`/national-show/exhibitors/international` → `/national-show/international-guests`.

## Brad's rulings

**Labels (2026-09-10).** Two separate pages, labelled **FAQ** and **Past Shows** —
the FAQ scoped to the upcoming show, Past Shows separate from it. Routes unchanged
(`/national-show/faq`, `/national-show/archive`); this is display copy only. The
manifest's "Questions" label is superseded; its "Past Shows" label already matches.

## Still open (Brad has not ruled)

1. **Tickets in the top row.** `nav-config.ts` carries an explicit rationale for its
   current top-level slot — "the conversion path, never nested two clicks deep inside
   a dropdown". Layout 4 removes it from the top row and gives it two places inside
   the flyout, one of them the primary button. Recommendation: the feature rail is
   enough; an eighth top-level item is what produced the 1240-1400px wrap problem.
2. **Lane split.** Brad said delegate to the NOS lane. The six routes are
   unambiguously theirs; the three chrome components are SAOC's and live on `main`,
   against a standing rule that SAOC and NOS design never mix. Recommendation: one
   lane takes both, with the brief pinning the SAOC palette and the gate proving no
   non-handoff literal entered the chrome.

## Source of truth
- Structure + order + groups + descriptor copy: `content/national-show-routes.json`
  on `origin/nos-site` (17 `listed: true` rows, four groups). Descriptors are each
  row's own `purpose` field, trimmed only.
- Top-level items: the Dev Status sheet's Pages tab.
- Every visual value: `design/design_handoff_saoc/colors_and_type.css` and
  `src/styles.css`. SAOC palette only — NOS tokens never enter SAOC chrome.

## Gate must prove
- All 17 hrefs in the rendered flyout return 200 (no 404 reachable from the header).
- `/national-show` is reachable from the header — it is not, today.
- No colour, font-family or size literal in the three chrome components that is
  absent from `colors_and_type.css`.
- Keyboard: trigger opens on Enter/Space, Escape closes and restores focus, tab order
  runs lead → groups → feature, no focus trap, visible focus ring on every leaf.
- 390px drawer: every leaf reachable, no horizontal scroll.
