# M7 golden — behavioural contract for `execution/checks/verify_nos_m7_hero_and_grammar.ts`

This file **commissions** a script that does not exist yet. `@dev` writes it in the
same pass as the component work. Every M7 assertion that is not a plain file check
runs through it, so the contract does not reference a script nobody was asked to
build.

Sibling for structure and idiom: `execution/checks/verify_nav_mega_menu.ts` —
same dev-server spawn, same HTTP readiness poll, same per-check record shape, same
`exit 2` for setup failure. Follow it; do not invent a second harness style.

---

## 1. Identity

| | |
|---|---|
| path | `execution/checks/verify_nos_m7_hero_and_grammar.ts` |
| invoked as | `node_modules/.bin/tsx execution/checks/verify_nos_m7_hero_and_grammar.ts` |
| dev-server port | **3412** (M7's own port; do not collide with a running dev server or another check) |
| browser | Playwright Chromium, **headless only** |
| results file | `.tmp/sandbox/nos-m7/results.json` |
| viewports | 390×844, 1024×768, 1280×900 (`deviceScaleFactor: 2`) |

Never `mcp__claude-in-chrome__*` — it prompts, and a prompt in a gate is a failed
gate (`.claude/rules/shell-paths.md`).

## 2. Why one script and a results file, not fifteen scripts

Each assertion in the contract must be `kind: shell` and must actually run. Fifteen
separate Playwright launches would take minutes and boot the Next.js dev server
fifteen times. Instead:

- **One driver assertion** runs the script. It spawns the server, drives every
  check, writes the results file, and exits non-zero if *any* check failed.
- **Every other assertion** is a `grep -q` against the results file. They are
  cheap, they name the specific defect they guard, and a failure points at one
  check rather than at "the browser check".

The driver must run first. Contract checks execute in order, so it is `A1`.

## 3. Output format — flat, greppable, one line per check

`.tmp/sandbox/nos-m7/results.json` is a JSON object whose keys are check ids and
whose values are drawn from a **closed set of exactly four strings** — `"PASS"`,
`"FAIL"`, `"BLOCKED"`, `"ERROR"` — **pretty-printed with one key per line** so
`grep -q '"H1_TEXT": "PASS"' ` matches a single line.

| value | meaning | gate assertion |
|---|---|---|
| `PASS` | the check ran and the property holds | green |
| `FAIL` | the check ran and the property does not hold — a real defect | red |
| `BLOCKED` | the check could not run because a **declared external precondition** was unavailable (see the `blocked_when` clause below). Says nothing about the code. | red |
| `ERROR` | the check threw — a bug in the check itself, not a verdict on the page | red |

**All three non-`PASS` values are red at the gate.** Only `PASS` satisfies a
`grep -q '"<ID>":.*"PASS"'`, so an unproven check can never be mistaken for a
proven one. The distinction exists for the *reader*: `FAIL` sends `@dev` to the
component, `BLOCKED` sends the orchestrator to the missing precondition, `ERROR`
sends `@dev` to the check. Collapsing them loses that routing, and the M7 run
already produced a case for each.

```
{
  "_generated_at": "2026-09-08T...",
  "_commit": "<git rev-parse --short HEAD>",
  "H1_TEXT": "PASS",
  "H1_FONT_CORMORANT": "PASS",
  ...
}
```

Rules that make the grep assertions honest:

- **Every id in §5 gets a key on every run.** Never a missing key, and never
  `"SKIP"` — `SKIP` is banned because it reads as "fine, moving on"; `BLOCKED`
  and `ERROR` read as "unproven", which is what they mean. A grep for `"PASS"` on
  an absent key does fail, which is correct, but a missing key hides *which*
  checks the run never considered. Write the measured value or the error text for
  every check — whatever its verdict — to a **separate** file,
  `.tmp/sandbox/nos-m7/detail.json`, keyed by the same ids.
- **`BLOCKED` is allowlisted, not discretionary.** A check may emit `BLOCKED`
  only if §5 or §6 declares a `blocked_when` precondition for it, stating the
  exact external artefact and why its absence is not a property of the code. Any
  other unrunnable check is `ERROR`. Without the allowlist, `BLOCKED` becomes the
  place inconvenient failures go — the same hazard §D2.1 of the hero golden names
  for a metric tuned until everything passes.
  - M7 declared exactly one `blocked_when`, and it is now retired.
    **`SCRIM_UNCHANGED`** — blocked when
    `.agent/memory/project/specs/nos-design-system/goldens/m7/scrim-baseline.json`
    (§6) is absent. Recording that as `FAIL` would assert the scrim moved; it
    would not have been looked at.
    - **Discharged 2026-09-08 — the baseline now exists and is tracked.** The
      carve-out existed because capture appeared to need a clean tree at the M6
      commit, which a concurrent M8 edit of `nos-theme.css` denied. A detached
      worktree removes that conflict entirely (§6), so the precondition was never
      really unsatisfiable and is now satisfied. `SCRIM_UNCHANGED` must therefore
      **never emit `BLOCKED`**: with the baseline committed, absence means a
      tracked file was deleted, which is a property of the code state and is a
      `FAIL` per §6. M7 ships with an empty `blocked_when` set.
  - **The baseline is a tracked golden, never a sandbox file.** `.tmp/` is
    gitignored, so a baseline written there disappears on any clean checkout and
    `SCRIM_UNCHANGED` reports `BLOCKED` forever — present, never failing, never
    proving anything, and invisible in its absence. That is strictly worse than
    no check at all, because the allowlist above makes the `BLOCKED` look
    legitimate. §6's path is the only correct one; this bullet previously named a
    `.tmp/sandbox/` path and was wrong.
- **The detail must not live in `results.json`.** The gate assertions are
  `grep -q '"<ID>":.*"PASS"'` against `results.json`; a detail entry whose text
  happened to contain `PASS` on the same line as its id would satisfy that grep
  and turn a failure green. Two files, one purpose each: `results.json` holds
  nothing but the flat id → `PASS`/`FAIL` map plus `_generated_at` and `_commit`;
  `detail.json` is for the human reading a failure.
- **The file is deleted and rewritten at the start of every run.** A stale results
  file from a previous run passing today's gate is the exact failure mode this
  design invites. Write to `.tmp/sandbox/nos-m7/results.json.tmp` and rename over
  the target only after all checks complete — a crash mid-run must not leave a
  half-file full of `PASS`. (`.tmp/` is gitignored; per `.claude/rules/sandbox.md`
  do not delete sandbox files as a cleanup step — overwriting the same path in
  place is fine, and is not the "delete a scratch file when done" that rule bans.)
- `_generated_at` and `_commit` exist so a reviewer can tell a fresh run from a
  cached one. Learned.md already records that this repo's gate is "a dated
  measurement, not a guarantee".

## 4. Exit codes

| code | meaning |
|---|---|
| 0 | every check `PASS` |
| 1 | the harness ran correctly and at least one check is `FAIL` — a real defect |
| 2 | **setup failure** — server never became ready, Playwright missing, page threw, image 404. No results file is trustworthy. |
| 3 | **incomplete** — no `FAIL`, but at least one check is `BLOCKED` or `ERROR`. The suite found no defect *and did not clear the page either.* |

Precedence when several apply: **1 > 3 > 0**. A run with one `FAIL` and one
`BLOCKED` exits 1 — the defect is the headline. Exit 3 is reachable only when
nothing failed.

Exit 2 must never be reported as a pass and must never be collapsed into exit 1.
A check suite that cannot start is not a suite that found no defects.

**Exit 3 is not a pardon.** It is non-zero, so it fails the driver assertion and
the gate stays red; the milestone is not done while a check is unproven. What it
buys is a correct diagnosis at a glance — exit 1 means go fix the component,
exit 3 means go supply the missing precondition (or fix the check) and re-run.
Never map 3 to 0, and never `|| true` it.

## 5. Check inventory

Ids below are the exact keys written to the results file and the exact strings the
contract greps for. Golden references are to `hero-dom.golden.md` (D-ids) and
`token-grammar.golden.md` (§-ids).

### Headline and lockup — D1

| id | asserts |
|---|---|
| `H1_TEXT` | `h1` text is exactly `The South African National Orchid Show` |
| `H1_FONT_CORMORANT` | computed `font-family` contains `Cormorant` (case-insensitive) |
| `H1_SENTENCE_CASE` | computed `text-transform` is `none` **and** the rendered string is not all-uppercase |
| `H1_DISPLAY_XL` | computed `font-size` equals the element's resolved `--display-xl`, ±0.5px |
| `H1_TWO_LINES_390` / `_1024` / `_1280` | measured line-box count is exactly 2 at each viewport |
| `EMBLEM_ABOVE_H1` | a mark element's rect bottom ≤ `h1` rect top, and its width ≤ 25% of the `h1` width |
| `HERO_NO_LOCKUP` | no emblem+wordmark lockup inside the hero section |
| `LOCKUP_IN_CHROME` | the full lockup renders in the NOS masthead **and** colophon on `/national-show` |
| `LOCKUP_NOT_GLOBAL` | the show lockup is absent from a non-NOS route (`/societies`) |

### Crop, collision and contrast — D2

| id | asserts |
|---|---|
| `HERO_OBJECT_POSITION` | the hero `<img>` computed `object-position` is **not** `50% 50%` — a focal point was declared |
| `BLOOM_CLEAR_OF_EMBLEM_390` / `_1024` / `_1280` | emblem rect + 8px padding is < 2% bloom-like pixels (D2.1 metric) |
| `BLOOM_BELOW_TYPE_390` | at 390, hero image rect top ≥ type block rect bottom |
| `SCRIM_UNCHANGED` | the hero's gradient layers match the recorded M6 baseline — see §6 |
| `CONTRAST_H1_390` / `_1024` / `_1280` | ≥ 4.5:1, composited pixels under the glyph boxes |
| `CONTRAST_LEDE_1024` | ≥ 4.5:1 |
| `CONTRAST_EYEBROW_1024` | ≥ 4.5:1 |

`1024` is mandatory everywhere it appears: it was the recorded worst case (4.78:1).

### Buttons — D3

| id | asserts |
|---|---|
| `ACTIONS_COUNT_THREE` | exactly 3 controls in the hero action row |
| `ACTIONS_RADIUS_2PX` | all four computed corner radii are 2px on all three |
| `ACTIONS_NO_UNDERLINE` | computed `text-decoration-line` is `none` on all three |
| `ACTIONS_ONE_FILLED` | exactly 1 opaque background; exactly 2 transparent **with** a ≥1px visible border |
| `ACTIONS_EQUAL_WEIGHT` | identical `font-size` and horizontal padding; heights within 2px |
| `ACTIONS_HREFS` | the href set is exactly `/tickets`, `/contact`, `/societies` |
| `ACTIONS_FOCUS_RING_EDGES` | keyboard focus produces a composited-pixel change at all four edge midpoints, on all three |
| `ACTIONS_FOCUS_RING_CORNERS` | the same at all four corners — the R2 regression |
| `ACTIONS_FOCUS_NOT_CLIPPED` | no ancestor of the action row imposes `overflow: hidden` cropping the ring band |
| `ACTIONS_FOCUS_IS_OUTLINE` | on all three, focused `outline-style` ≠ `none` **and** `outline-width` > 0 |
| `CONTRAST_ACTION_LABELS_1024` | each label ≥ 4.5:1 against its own composited ground |

`ACTIONS_FOCUS_RING_CORNERS` is a separate id from `_EDGES` deliberately: a ring
that clears the edges and fouls the corners is the *specific* defect R2 predicts,
and collapsing them into one id would let it hide behind a passing edge test.

`ACTIONS_FOCUS_IS_OUTLINE` is R9/1 stated as a property, not a picture. The three
pixel claims above are affordance-agnostic — a `box-shadow` ring changes composited
pixels exactly as an outline does, so they cannot tell the two apart. An on-disk
probe of the live site (2026-09-08) found the NOS text inputs on
`/national-show/vendors/apply` and `/national-show/vendors/register` take focus via
`box-shadow` alone, with `outline` staying `none` — a 2px `rgb(251,250,240)` spacer
plus a 4px ring at alpha 0.4, which is R9/1 and R9/2 failing in one declaration.
The reference implementation is `/national-show/tickets` "Get visitor tickets": a
solid 2px `rgb(126,63,151)` outline. Read `outline-style` and `outline-width` as
strings; do not read the ring's **colour** from the stylesheet — that is a
composited-pixel measurement (see the oklab note below).

### Eyebrow — D4

| id | asserts |
|---|---|
| `EYEBROW_MATCHES_COUNTDOWN` | eyebrow `font-family`, `font-size`, `letter-spacing`, `color` all equal a live `ShowCountdown` unit label's, measured in the same render |
| `EYEBROW_UPPERCASE` | `text-transform: uppercase` on both |
| `EYEBROW_ABOVE_COUNTDOWN` | eyebrow rect bottom ≤ countdown block rect top |

`ShowCountdown` is at `components/show/ShowCountdown.tsx`, not `components/nos/`.

### Token grammar — token-grammar.golden.md

| id | asserts |
|---|---|
| `RADIUS_CARDS_ZERO` | every `components/nos/` card surface rendered on `/national-show` computes `border-radius: 0px` |
| `RADIUS_PILL_ALLOWLIST` | no element computes a radius > 4px except the four allowlisted eyebrow-pill sites and the 12px `CycleStep` rail dot (§4) |
| `BORDER_PRIMARY_1PX` | `--border-primary` resolves to `1px` inside `.nos-theme` |
| `NO_SHADOWS` | no element under `.nos-theme` has a non-`none` computed `box-shadow`, excluding `:focus-visible` state |
| `SHADOW_TOKEN_GONE` | `--shadow-card` resolves to empty inside `.nos-theme` |

Radius and shadow are **browser** checks, not greps — a grep cannot see radius
arriving through a class the file does not name.

### Regression guard — D2.3

| id | asserts |
|---|---|
| `OTHER_HERO_UNCHANGED` | a second NOS hero (`/national-show/plan-your-visit`) renders its title at the pre-M7 size and its scrim band unchanged — removing `titleIsElement` must not alter the other eleven call sites |

### Negative controls

| id | asserts |
|---|---|
| `NEGCTL_CONTRAST_DETECTS_FAILURE` | a synthetic low-contrast probe injected into the page is scored **below** 4.5:1 by the same code path the real checks use, then removed before any real measurement. PASS means the harness correctly reported a failure. |
| `NEGCTL_BLOOM_METRIC_DISCRIMINATES` | a control rect on the declared focal point measures **above** the bloom-like threshold |

Both must be `"PASS"` in the results file and both get their own contract
assertion. A harness that has never failed has not been shown capable of failing;
`NEGCTL_CONTRAST_DETECTS_FAILURE` is the one that makes every other contrast number
in this contract mean something.

`NEGCTL_BLOOM_METRIC_DISCRIMINATES` is the guard on §D2.1's classifier constants,
which are **fixed, not tunable** (see D2.1's defect-correction note: chroma ≥ 0.08,
lightness in [0.15, 0.90]). If anyone moves them to make `BLOOM_CLEAR_OF_EMBLEM_*`
pass, this control goes red — a metric tuned until everything passes has stopped
measuring. It is also the tripwire on the composite itself: the lightness floor
sits on a cliff, so if the scrim stack darkens further the control goes red before
any bloom check does. That is the control working, not a harness regression, and
the response is the R4 design escalation, never a floor adjustment.

## 6. `SCRIM_UNCHANGED` — how to check "the scrim did not move"

R4 forbids fixing the collision with the scrim, and the temptation under contrast
pressure is real. The check must be able to see a scrim change even though the
scrim is expressed as Tailwind arbitrary gradient utilities.

Record, at first run, the computed `background-image` string of each of `NosHero`'s
gradient layers at 1280 into `.agent/memory/project/specs/nos-design-system/goldens/m7/scrim-baseline.json`,
captured from the **pre-M7 build**. The baseline must be the M6 rendering, not a
snapshot of the change under test.

**Never `git stash` to obtain it.** A stash mutates a working tree that a
concurrent milestone may be mid-write in — during M7 that was M8 editing
`nos-theme.css` — and a stash/restore race silently loses another agent's
uncommitted work. Use a **detached worktree** at the pre-M7 commit, served on its
own port. That leaves the working tree untouched and needs no coordination.

**Captured 2026-09-08.** Detached worktree at `24f87e05`, served on port 3921.
Confirmed genuinely pre-M7 by *rendered* evidence rather than by commit hash: the
M6 render's `<h1>` is the Logo lockup containing an `<img>` — the `titleIsElement`
path M7 removed — while the current render is typographic with no `img`. All three
captured gradient strings are byte-identical to the current tree's, which is the
**expected** result: D2 requires the scrims keep their current stops and
opacities, so identity is the check passing, not the capture failing. `@dev`
stopped and asked before writing rather than assuming, which was right — identical
strings are also what a broken capture looks like, and the render check
distinguished the two.

`SCRIM_UNCHANGED` then compares the current computed strings to that file. Any
added layer, changed colour stop, or changed opacity is a FAIL. If the baseline
file is missing, the check is a `FAIL` with a `_detail` explaining that the
baseline was never captured — never a silent pass. The baseline is a **tracked
golden**, so absence now means a tracked file was deleted, which is a code-state
fact and belongs in `FAIL`.

This is the one assertion whose baseline `@dev` generates rather than the
architect: a computed gradient string is a rendering artefact, not a design
decision, and hand-writing it here would encode a guess.

## 7. Constraints on the implementation

- Headless Playwright only; no Claude-in-Chrome.
- No colour string parsing to produce a contrast ratio. Tailwind v4 emits
  `oklab()`; regex-extracting an `rgb()` triple returns plausible wrong numbers
  (InunuNet/SAOC#3). Contrast comes from screenshot pixels, always.
  The single legitimate computed-colour comparison is
  `EYEBROW_MATCHES_COUNTDOWN`'s **equality** test between two values produced by
  the same serialiser in the same render.
- Sandbox paths only: `.tmp/sandbox/nos-m7/`. Never `/tmp`, never the session
  scratchpad, never `mktemp -d`.
- Screenshots kept alongside the results file (`.tmp/sandbox/nos-m7/shots/`) so a
  failure can be looked at rather than argued about.
- No `cd`; every path in the script and in its contract command is repo-root
  relative, and the contract command itself is a single line.
- The dev server the script spawns must be shut down on every exit path, including
  exit 2. A leaked server on 3412 poisons the next run.
