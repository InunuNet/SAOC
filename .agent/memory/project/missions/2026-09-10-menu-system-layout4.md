# Mission — Menu System (Layout 4)

Opened 2026-09-10. Slug: `menu-system-layout4`.
Owning lane: **this lane (SAOC lead)**. The NOS lane builds no part of the menu.

This file is the mission's own record. It is written to survive a compaction:
anything needed to run the mission end to end is stated here, not assumed from
conversation.

---

## 1. What was approved, and by whom

Brad approved **Layout 4** on 2026-09-10, choosing it from four populated
options in artifact
`https://claude.ai/code/artifact/b9eadbd4-e165-4de9-884d-86acc9fbf2a2`.

His words framing the exercise, twice, and they bound the scope:

> "this is the design/style we need to approve the drop down system look etc,
> not a redesign"

> "we just building a menu system the system use the predefined designs we
> already have, I just need to see how the nesting / lfyouts or whatever you
> call them are going to work."

**This is a layout approval only.** No new colours, faces, sizes, spacing values
or components are authorised. Every visual value comes from the approved handoff.
Nothing in this mission authorises design work; if a value is needed that the
handoff does not define, that is a gap to name and ask about, per
`docs/rules/no-invention.md`.

### The approved shape

A full-width sheet below the header, spanning the container, in five tracks:

| track | contents |
|---|---|
| lead block | mono eyebrow "The National Show"; serif lead "19th SAOC National Orchid Show" linking the hub; venue + dates line; then the **The Show** group (Tickets / Show Sponsors / Past Shows) folded underneath |
| track 2 | **Visit** — 4 leaves |
| track 3 | **Programme** — 5 leaves |
| track 4 | **Exhibit & Trade** — 4 leaves |
| feature rail | bone panel: mono date meta, serif "Tickets" heading, one-line blurb, primary Buy tickets button |

Each leaf is a bold 14px name over a 12px muted descriptor, separated by a hairline
rule, last leaf in a group unruled.

**Accepted trade-off, stated to Brad before he chose:** the lead block and feature
rail consume the width of two groups, so "The Show" folds into the lead column
instead of getting a column of its own. He accepted this explicitly.

---

## 2. Rulings on record

| # | ruling | date |
|---|---|---|
| R1 | Layout 4 is the approved dropdown layout | 2026-09-10 |
| R2 | Labels are **FAQ** and **Past Shows** — two separate pages, the FAQ scoped to the upcoming show. Routes unchanged (`/national-show/faq`, `/national-show/archive`); display copy only. Supersedes the manifest's "Questions" label. | 2026-09-10 |
| R3 | WOSA's route is **`/national-show/wosa-conference`**, not `/national-show/wosa`. **This overturns answered question 23.** Reason: WOSA (Wild Orchids of Southern Africa) is a separate partner organisation with its own site, hosting *their* conference at the same venue and time as the Show. `/wosa` would read as a page about the partner and Brad wants that slug free for a possible future partner page. `nav-config.ts` already points at `/wosa-conference`, so that entry was never wrong — it simply had no page behind it. | 2026-09-10 |
| R4 | Lane split: this lane builds all chrome; the NOS lane builds the six missing routes and lands M4. Delegated to this lane by Brad and decided here. | 2026-09-10 |

### Still unruled — Brad has not answered

**Tickets in the top row.** `components/chrome/nav-config.ts` carries an explicit
written rationale for its current top-level slot: "the conversion path — never
nested two clicks deep inside a dropdown". Layout 4 removes it from the top row
and gives it two placements inside the flyout, one of them the primary button.

Recommendation: the feature rail is sufficient; an eighth top-level item is what
produced the documented 1240–1400px wrap problem. **@architect must not silently
resolve this** — build the nav golden with Tickets out of the top row, and flag
it in the contract as a reversible one-line decision so Brad can overturn it
without a rebuild.

---

## 3. Scope — what this lane builds

All in the shared repo, on a branch, PR to `main`. No self-merge.

### F1 — `components/chrome/nav-config.ts`
Restructure. Ten top-level items become seven plus the Contact button:

    About · Societies · Judging & Awards · Events · Members · National Show ▾ · Sponsors

All 17 `listed: true` Show routes move inside the **one** `National Show` mega,
in the manifest's four groups and manifest order. The current structure —
Visit / Programme / Exhibit promoted to three separate top-level megas, Tickets
and Past Editions standalone, and **no item pointing at `/national-show` at
all** — is superseded.

The existing `NavItem` union has no room for the approved shape. It needs:
- a lead block (eyebrow, serif lead + href, meta line)
- a per-group heading with optional href
- a per-leaf descriptor string
- a feature rail (meta, heading, blurb, cta label + href)

Type changes are additive where possible. `quiet` is still consumed by
`Header.tsx` and `MobileMenu.tsx` (landed 2026-09-10 in `5981d31b`) — do not
remove it without checking both readers.

### F2 — `components/chrome/MegaMenu.tsx`
Today: one narrow anchored panel, `min-w-[280px]`/`sm:min-w-[520px]`, n columns.
Becomes the full-width sheet.

**Keep the existing disclosure semantics verbatim.** They are already correct and
were not part of what Brad reviewed: `aria-haspopup`, `aria-expanded`, open on
click and Enter/Space, Escape closes and returns focus to the trigger, outside
mousedown closes, blur outside the container closes. Changing them is out of
scope.

### F3 — `components/chrome/MobileMenu.tsx`
Drawer carries the feature block at the top of the expanded National Show
section, then the four groups as headed lists with descriptors.

Constraint from Brad, from the earlier round: mobile menu font was "way too big".
The handoff's mobile drawer link size is **17px** (`design/design_handoff_saoc/src/styles.css`
371–419). Do not exceed it; group leaves sit below it.

### F4 — `components/chrome/Header.tsx`
Only as far as the nav restructure forces. The lockup, utility bar, search and
Contact button are untouched.

### F5 — dead nav target
`/national-show/exhibitors/international` → `/national-show/international-guests`.
The manifest is the authority for the new path.
(The WOSA entry needs no change — see R3.)

---

## 4. Out of scope — the NOS lane's work

They build the six routes that do not exist on `main` and would be live 404s
behind the new flyout:

    /national-show/programme
    /national-show/symposium
    /national-show/wosa-conference
    /national-show/sa-exhibitors
    /national-show/international-guests
    /national-show/sponsors

They are also landing M4 (36 commits on `origin/nos-site` as of 2026-09-10).
The dependency runs one way: **the flyout cannot gate green until those six
return 200.** Nothing else in this mission is blocked by them — F1–F4 can be
built and reviewed against the golden while their routes are in flight.

---

## 5. Sources of truth — cite these in every brief

| what | where |
|---|---|
| structure, group membership, order, and descriptor copy | `content/national-show-routes.json` on `origin/nos-site` — 17 rows with `listed: true`, four groups (`visit` 4, `programme` 5, `exhibit-trade` 4, `the-show` 3). Descriptors are each row's own `purpose` field, **trimmed only, never rewritten** |
| top-level items | the Dev Status sheet's Pages tab |
| every colour, face, size, spacing value | `design/design_handoff_saoc/colors_and_type.css` and `design/design_handoff_saoc/src/styles.css` |
| nav golden | `.agent/memory/project/specs/ticketing-complete/goldens/f7-nav-targets.json` (on `main` as of `9741a922`) |
| the rule that governs all copy | `docs/rules/no-invention.md` — as amended 2026-09-10 to per-block provenance |

Handoff values that the brief must quote rather than leave to interpretation —
this is the failure mode that already cost one round, when a designer invented a
dark header, uppercase mono labels and a 44px serif mobile list from a brief that
said only "reproduce the handoff faithfully":

- header: parchment ground, sticky, 18px padding (`styles.css` 279–297)
- nav link: Manrope 14px/500, **sentence case**, brass active underline (309–338)
- mobile drawer: right side, `min(360px, 90vw)`, 17px links (371–419)
- palette: sage `#384138`, brass `#9e8c6b`, parchment `#f4f3ec`, bone `#e8e6dc`,
  ink `#171917`; Crimson Pro / Manrope / JetBrains Mono

**SAOC and NOS palettes never mix.** NOS redeclares the same token names to
different values. No NOS token, and no asset from `branding/National Show 2027/`,
enters SAOC chrome.

---

## 6. What the gate must prove

Written as properties, not as steps. Each must fail against a negative fixture —
an assertion satisfiable without the property it claims to prove is this repo's
audited defect class, and a checker that does not exist is its purest form.

1. **No 404 reachable from the header.** All 17 hrefs in the rendered flyout
   return 200. `e2e/nav-links-200.spec.ts` (on `main`) already asserts this
   shape; it becomes true only once the NOS routes land.
2. **`/national-show` is reachable from the header.** It is not today — no nav
   item points at it. This is the specific defect Brad reported from the live
   site.
3. **No unsourced visual value.** No colour, font-family or font-size literal in
   the four chrome components that is absent from `colors_and_type.css`.
   `contracts/checks/ticketing-complete-f6/check-style-freeze.mjs` is the
   existing pattern to extend.
4. **Keyboard.** Trigger opens on Enter/Space; Escape closes and restores focus
   to the trigger; tab order runs lead → groups → feature rail; no focus trap;
   visible focus ring on every leaf. `e2e/nav-keyboard-operable.spec.ts` exists.
5. **390px drawer.** Every leaf reachable, no horizontal scroll.
   `e2e/mobile-nav-reaches-every-section.spec.ts` and
   `e2e/no-horizontal-overflow.spec.ts` exist.
6. **Descriptors are sourced.** Every descriptor string in `nav-config.ts` is a
   trimmed prefix of its manifest row's `purpose`, not free text. This is
   mechanically checkable and must be checked — it is the back door through
   which invention enters a menu.
7. **Nothing unmeasured reports as passing.** Any assertion whose checker is
   absent, or whose baseline is missing, renders UNMEASURED or SKIPPED — never
   PASS, never silently absent from the count.

---

## 7. Chain

`@architect` (contract + goldens, including negative fixtures) → `@dev` →
`@qa` → Codex GPT-5.5 (`execution/codex_qa.sh`, mandatory) → `@docs` →
`contract.py` gate → `@maintainer` → commit → PR to `main`.

Standing rules that apply: no contract, no `@dev` dispatch; no golden files, no
`@dev` dispatch; `@dev` never writes QA inputs; PR review before `main`, no
self-merge; and — Brad, 2026-09-10 — **a mission is not finished until it is
committed all the way through.** That rule exists because this mission's own
predecessor, `ticketing-complete`, left its contracts, goldens, evidence and e2e
suite uncommitted for days; they landed today in `11bdb450`…`9741a922`.

---

## 8. State at open

- `origin/main` = `9741a922` (this lane pushed 9 commits on 2026-09-10).
- `origin/nos-site` = `c7ff9fe9`, 36 commits ahead of the old base, rebasing onto
  `9741a922` now.
- Working tree clean but for two deliberate exclusions: `download.xml` (a stray
  `.docx` misnamed, at repo root — not project content) and a stale
  `SESSION_STATE.md.lock`.
