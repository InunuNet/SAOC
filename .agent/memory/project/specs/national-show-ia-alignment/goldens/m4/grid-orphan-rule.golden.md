# Golden — R13, the grid orphan rule, derived at runtime

**Ruling R13 (design lane, relayed by Brad 2026-09-10):** for `n` items in `c` columns,
`n mod c != 1` when `n > c`; choose the largest `c` up to 4 that satisfies it; `n == c` takes
`c`. **`c` must be DERIVED from the rendered count at runtime — never a hardcoded column
class.**

A lone item on a final row reads as a mistake in a formal, editorial layout. The rule removes
it. The *derivation* requirement is the part that is easy to fake and hard to catch, which is
why two independent assertions guard it.

---

## 1. The function

`lib/grid-columns.ts`:

```ts
export type GridColumns = 1 | 2 | 3 | 4;
export interface GridLayout { columns: GridColumns; finalCardSpans: GridColumns }
export function resolveGridLayout(n: number): GridLayout
```

Pure. No DOM, no config, no side effects.

1. `n < 3` → `{ columns: n || 1, finalCardSpans: 1 }`.
2. Otherwise walk `c` from `min(4, n)` **down to 3** — never to 2, see §1.2 — and return the
   first `c` for which `n <= c || n % c !== 1`, with `finalCardSpans: 1`.
3. **If no `c` in that range qualifies**, take the content ceiling `c = min(4, n)` and set
   `finalCardSpans = c`: the final card spans the empty remainder.

`min(4, n)` is the reading of "`n == c` takes `c`": you never have more columns than items.
Without that cap, `n = 2` would select `c = 4` — two items adrift in a four-column grid.

### 1.1 The tie-break — Codi's ruling, and why the obvious answer was wrong

The lead's first instinct was *minimise orphans*: take `c = 4` at `n = 13` and accept a final
row of one. **Codi rejected that.** The defect R13 exists to remove was never "one card in a
row" — it was **dead cells beside a lone card**. Minimising orphans leaves exactly those.

**Ruling: keep the content ceiling and let the final card span the remainder.** At `n = 13`,
`c = 4` → three full rows of four plus one full-width card. No dead cells, no partial row.

Two prohibitions ship with it, and both are asserted because both are ways to satisfy the
letter and lose the point:

| | assertion |
|---|---|
| **Never leave the orphan in a partial row** | `G4` — browser-measured, the final item's column span equals the tracks remaining in its row |
| **Never centre it** | `G5` — browser-measured, the spanning card's left edge equals the grid's content-box left edge, with no auto inline margins and no `justify-self: center`. A lone centred card is the accidental-looking version of the same defect, **and it would pass `G4`** |

### 1.2 Breakpoints — `c >= 3` binds, `c = 2` is EXEMPT BY RULING

Not unasserted by omission. **The distinction is the point: an unasserted case reads as a gap
in the gate; an exempt one is a recorded decision.** Anyone auditing this file should be able
to tell instantly which they are looking at.

Codi's reasoning, recorded so it is not re-derived at a keyboard: a two-column grid reads as a
list more than a grid; one empty cell beside a trailing card is mild; and dropping a tablet to
a single column to avoid it is worse than tolerating it. At `c = 1` the case cannot arise.

`G6` asserts this statically on the helper — its orphan search floor is 3 and it never rejects
a candidate below that. So a future edit that quietly extends the rule to two columns, **or
quietly stops applying it at three**, fails.

Revision 3 of this golden said "M4 applies R13 at the desktop breakpoint only" and flagged the
gap. That was superseded: desktop-only was nearly right but wrong in a way that mattered — five
items at `c = 2` orphan exactly as four columns do, and the honest position is a ruled
exemption rather than silence.

### 1.3 The golden table (`G1` tests all of it, `n` from 0 to 40)

`columns` / `finalCardSpans`:

| n | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | **13** | 14 | 15 | 16 | 17 | 24 | **25** | 36 | **37** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **c** | 1 | 2 | 3 | 4 | **3** | 4 | 4 | 4 | **3** | 4 | 4 | 4 | **4** | 4 | 4 | 4 | **3** | 4 | **4** | 4 | **4** |
| **span** | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | **4** | 1 | 1 | 1 | 1 | 1 | **4** | 1 | **4** |

`n = 0` returns `{ columns: 1, finalCardSpans: 1 }` — an empty listing renders its empty state,
not a grid, but the function is total and never throws.

The spanning cases are `n ≡ 1 (mod 12)` with `n > 4`: **13, 25, 37**. Those are the only `n`
where neither 4 nor 3 avoids the orphan. The nursery directory is exactly the kind of listing
that could land on 13, which is why this is closed rather than documented.

## 2. The Tailwind constraint, and where literals are allowed

Tailwind v4 scans source for complete class names, so `` `grid-cols-${c}` `` produces no CSS.
The class must come from a static map:

```ts
const COLUMN_CLASS: Record<GridColumns, string> = {
  1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4',
};
const SPAN_CLASS: Record<GridColumns, string> = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4',
};
```

`SPAN_CLASS` exists for the same scanner reason as `COLUMN_CLASS`: a template literal produces
no CSS, so the spanning final card needs a complete class name too.

**`lib/grid-columns.ts` is the only file permitted to contain a `grid-cols-` literal.**

## 3. The two assertions, and why one is not enough

### `G2` — static: no hardcoded column class on any surface M4 builds

The string `grid-cols-` appears in **zero** files across this scope, with
`lib/grid-columns.ts` — which holds the static class map — the only place a literal may live:

```
app/(marketing)/national-show/page.tsx          the hub
app/(marketing)/national-show/about|programme|symposium|wosa|
    sa-exhibitors|international-guests|sponsors the six created routes, plus about/
components/show/ShowSectionNav.tsx              the second reachability surface
components/show/nos/                            where every new M4 component lives
```

This catches the whole failure mode directly. It is **not satisfiable by a comment** — a
comment containing `grid-cols-` fails it too. That is a false positive by construction, and
the correct response is to reword the comment, never to relax the grep. Stated here so the
next reader does not "fix" the check.

**New M4 components live in `components/show/nos/`.** That is a routing decision made so the
grep has a stable, total scope: a new listing component dropped anywhere else under
`components/` would be outside the check and nobody would notice.

#### The scope, and the one boundary that stays

`components/show/**` is **ours** — the other lane handed it over at revision 4. All of it
renders under `/national-show`, and splitting it by route would be a fiction. **The revision-3
deferrals are removed, not relaxed**: `AccommodationList`, `TravelRoutes`, `ExhibitorQuestions`
and `ExhibitorSteps` all migrate, because they deferred to a lane that no longer owns them.

What stays out of the sweep is the **untouchable routes' own `page.tsx` files** — `tickets/`,
`conferences/`, `exhibitors/`, `vendors/`, `archive/`. Their constraint is not source
ownership, it is **rendered output** (`S1`), so a source-level grep is the wrong instrument
for them either way.

#### The collision this creates, named so nobody picks a side quietly

`ExhibitorQuestions` and `ExhibitorSteps` render on `/national-show/exhibitors`, which is
identity-constrained. Migrating their grids is now required by `G2` — and if
`resolveGridLayout` returns a different column count than they render today, **`S1` goes red.**
A real R13 fix colliding with a real identity guarantee.

**Ruling (`D92`): the snapshot wins.** The other lane ruled rendered output; R13 is ours; a
unilateral change to their page is exactly what the identity constraint forbids. @dev
escalates to the lead — it does not regenerate the baseline, and it does not quietly exempt the
component. `S4` pins that no baseline was regenerated to make such a collision disappear.

This is the same hazard revision 3 found from the other direction, and it is worth stating in
general: **a path-based "did you edit the untouchable route" check passes while a shared
component underneath changes what that route renders.** The assertion is satisfiable without
the property it claims to prove — this repo's audited defect class — which is why every
route-level claim in M4 now reads rendered output instead of paths.

### `G3` — runtime: the rendered grid actually has that many tracks

`G2` alone passes if someone writes `resolveGridLayout` and then ignores its return value, or
puts a wrong literal inside the allowed file.

- **`G3a`** — unit: `resolveGridLayout(n)` matches the golden table for `n` in 0..40 — **both fields** —
  and `COLUMN_CLASS` and `SPAN_CLASS` each have exactly four entries mapping 1..4.
- **`G3b`** — **headless Playwright** (never Claude-in-Chrome, which `.claude/rules/shell-paths.md`
  forbids here because it prompts, and an assertion that prompts cannot run in a gate), at 1280: for a real rendered listing, the container's computed
  `grid-template-columns` **track count** equals `resolveGridLayout(memberCount).columns` for the
  count actually on the page. Measured on at least the hub's four groups, whose member counts
  are 4, 5, 4, 3 → expected track counts **4, 3, 4, 3**.

The `programme` group (5 members → 3 tracks) is the load-bearing case. A hardcoded
`lg:grid-cols-4` renders 4 tracks there and fails `G3b`, while passing every count-based and
link-based check on the page.

## Provenance of R13, and a note on the mirror

R11, R12 and R13 are cited **by number against Codi's record**
(`nos-design-rulings.md` in the `~/ai/SAOC NOS Design` workspace, R1–R13, commits `6687b13` /
`5c103ea`). **Our local copy at the same relative path is a stale mirror carrying R1–R10 only,
and is not the authority.** That is mirror drift, not a missing ruling — do not block on it,
and do not treat the local file as complete. Refreshing it is Brad's call.

## What this golden does not settle

- **Gutter, card height, and whether rows equalise.** Codi's.
- **What a spanning final card looks like** — whether it fills with content, changes its
  internal layout, or simply stretches. Codi's; `G4`/`G5` constrain only its geometry.
- **Whether `SPAN_CLASS` needs breakpoint variants below `lg`.** At `c <= 2` the span case
  cannot arise (§1.2), so the desktop map suffices; if the design ever introduces a
  three-column tablet, this needs revisiting.
