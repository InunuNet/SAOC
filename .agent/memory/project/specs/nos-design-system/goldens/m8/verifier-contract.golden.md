# M8 golden — the verifier harness (F23 + F24)

Binding reference for the check script both features are gated on. The two subject goldens
(`status-tokens.golden.md`, `focus-affordance.golden.md`) say *what must be true*; this file
says *how the gate proves it*.

---

## 1. Identity

| | |
|---|---|
| script | `execution/checks/verify_nos_m8_status_and_focus.ts` |
| run as | `node_modules/.bin/tsx execution/checks/verify_nos_m8_status_and_focus.ts` |
| dev server | `http://localhost:3413` — M8's own port |
| results | `.tmp/sandbox/nos-m8/results.json` |
| detail | `.tmp/sandbox/nos-m8/detail.json` |
| captures | `.tmp/sandbox/nos-m8/shots/` |

Port 3413 is not decoration. M7 ran on its own port for the same reason: a verifier that
attaches to whatever happens to be on 3000 will happily measure a stale build from another
session and report green. The script starts its own server on 3413, or fails.

`.tmp/` is gitignored, inside the project, and never deleted — see `.claude/rules/sandbox.md`.
Nothing here writes to `/tmp`, the session scratchpad, or a `mktemp -d`.

## 2. One driver, many checks

**Every browser-measured assertion in `contract-m8.yaml` greps a result this one script wrote.**
No assertion launches its own browser.

The alternative — one Playwright launch per assertion — was tried by earlier milestones and is
wrong on three counts: ~25 cold Chromium launches against a Next dev server takes longer than
the gate's tolerance; each launch re-triggers the same form and re-measures the same pixels, so
a flake in one assertion is uncorrelated with a flake in its neighbour measuring the identical
thing; and the assertions stop being independent evidence and become independent *chances to
fail*. One driver takes one set of measurements from one page state, and the assertions read it.

The cost is a shared-fate risk: if the driver dies, everything greps a missing file. That is
what the `A0_*` block exists to catch, and it is why the driver's own exit code is asserted
separately from the results it wrote.

## 3. The results/detail split

`results.json` — one flat object, `{"<CHECK_ID>": "PASS" | "FAIL" | "SKIP", ...}`. Nothing else.
Every assertion in the contract greps this file with a single-line pattern.

`detail.json` — the measurements: ratios, RGB triples, `mixFit` values, hue and saturation
readings, bounding boxes, capture filenames, and the reason string for every non-PASS.

The split is not tidiness. A results file carrying `_detail` blobs is one where
`grep -q '"X":.*"PASS"'` can match a substring of a diagnostic message instead of a verdict —
the exact "assertion satisfiable by something that isn't the real property" defect class this
project has already audited. `A0_DETAIL_SEPARATE` asserts the split holds.

## 4. Exit codes

| code | meaning |
|---|---|
| 0 | every check ran and every check PASSed |
| 1 | the run completed; at least one check FAILed |
| 2 | the harness itself broke — server never came up, Playwright launch failed, a route 500'd, a required element was never found |

**2 is never collapsed into 1.** A harness that cannot measure has not measured a failure; it
has failed to measure, and those are different facts. Collapsing them lets a broken driver read
as a legitimate red, which is how a green-after-fix becomes meaningless. `A0_DRIVER` asserts
exit 0 specifically.

Timeout: 900 seconds, declared on `A0_DRIVER`. Two viewports × two routes × a full tab sweep is
minutes, not seconds, on a cold Next dev build.

## 5. Measurement technique — the two primitives

Both features rest on the same two primitives, and neither reads a colour string.

### 5.1 Composited-pixel contrast

Screenshot the region, read the RGB at the pixel of interest and at an adjacent ground pixel
from the raster, and compute WCAG 2.x relative-luminance contrast from those integers.

**Never `getComputedStyle()` + regex.** Tailwind v4 serialises opacity-modified colours as
`oklab()` / `color(...)`, and a naive parse of those returns numbers that are plausible and
wrong — filed as InunuNet/SAOC#3. The rendered pixel is the only thing that is true regardless
of how the engine chose to serialise the declaration.

`NEGCTL_CONTRAST_DETECTS_FAILURE` proves the metric can say no: run it against a known-failing
pair (`#7e3f97` on `#1a1445`, the R9/3 defect, 2.48:1) and require the metric to report below
3:1. A contrast function that always returns a passing number passes every real check too.

### 5.2 `mixFit` — which token painted this, and at what alpha

Given the composited pixel `P`, the ground `G`, and a candidate token colour `T`, solve for the
scalar `α` minimising `|P − ((1−α)·G + α·T)|`, and report both `α` and the residual.

- residual near zero and `α ≈ 1.0` → the element is painted with `T` at full opacity.
- residual near zero and `α < 1` → painted with `T` **through an alpha modifier**. This is the
  `/40` defect class, caught without ever parsing `rgb(… / 0.4)`.
- large residual → not `T` at all.

Threshold: `α ≥ 0.98` counts as opaque. Below that fails.

`NEGCTL_MIXFIT_DETECTS_ALPHA` proves it: synthesise the composite of `--ink` at 40% over
`--ivory` and require `mixFit` to report `α ≈ 0.4`, not `1.0`.

### 5.3 The ring-diff — proving a focus ring exists at all

For each focusable control: capture its bounding box inflated by 8px **before** focus and
**after** focus, and diff the two rasters. A ring is a band of changed pixels outside the
control's border box.

This is the only technique that proves an indicator is *visible*, as opposed to declared. It
also counts indicators: two concentric changed bands separated by unchanged pixels is a double
ring, which is the `FOCUS_ONE_INDICATOR_CARDS` failure, and it is a clipped ring when the band
is present on some edges and absent on others (`FOCUS_NOT_CLIPPED`).

`NEGCTL_RING_DIFF_DETECTS_ABSENCE` proves it: run the diff against an element with
`outline: none !important` applied inline and require it to report no ring.

## 6. Route and trigger plan

| surface | route | why |
|---|---|---|
| status, primary | `/national-show/vendors/apply` | public; empty submit → 400 → banner. See `status-tokens.golden.md` §7. |
| status, secondary | `/national-show/vendors/register` | public (ungated branch); bogus code → same banner shape. |
| focus, light ground | both of the above | `VendorFormField` inputs, the `ring-ink/40` defect at its highest-traffic site. |
| focus, dark ground | `/national-show` | the hero CTA is a `Button variant="on-dark"` on a dark photographic ground — the R9/3 defect *in situ*, not simulated. |
| leak control | a non-NOS route (`/contact`) | proves the NOS tokens resolve to nothing outside `.nos-theme`. |

**What is not reachable, stated plainly.** `VendorRegisterForm` and everything it contains —
including `VendorMarketingFieldset:62`, `VendorMarketingUploadField:97`, and the two equipment
tables' `ring-ink/40` sites — render only behind a vendor registration session token, which a
headless gate cannot mint. Those sites are fixed by @dev and covered by **static** assertions
only. The contract must not carry a browser assertion that claims to have measured them; an
assertion that silently measures an empty set is worse than no assertion.

The dark-ground token flip has one *in-situ* rendered case (the hero CTA focus ring) and no
rendered status case — no in-scope status element sits on a dark ground today. The status flip
is therefore proven by an injected probe (§7), and `TOKENS_FLIP_ON_DARK` is honestly a
**mechanism** proof, not a deployment proof. Do not let it be described as more than that.

## 7. The token probe

To measure a token's value without reading a colour string: inject a `<div>` inside
`.nos-theme` (and, for the flip, inside a `<div class="nos-on-dark">`), size it, paint it
`background: var(--status-error)` at full opacity over a known ground, screenshot, and read the
RGB back from the raster. Derive ratio, hue, HSL saturation and HSL lightness from those
integers.

The probe is removed before the focus sweep runs, and its presence is asserted not to perturb
the status counts (it carries no status class and no text).

`.nos-on-dark` **does not exist in the codebase today** — no TSX file references it. @dev
introduces it. The probe therefore constructs it directly rather than looking for an element
that happens to carry it, and no assertion assumes any real element does.

## 8. Check inventory

### 8.0 Harness integrity — the `A0_` block

| id | asserts |
|---|---|
| `A0_DRIVER` | the driver runs and exits 0 (timeout 900s) |
| `A0_SCRIPT_EXISTS` | `test -f` on the verifier path |
| `A0_RESULTS_FRESH` | `results.json` records the current `git rev-parse HEAD` |
| `A0_DETAIL_SEPARATE` | `detail.json` exists **and** `_detail` does not appear in `results.json` |
| `A0_NEGCTL_GREP_DISCRIMINATES` | a check id the driver never emits does **not** match the grep pattern |

`A0_RESULTS_FRESH` is the one that stops a green gate from being a memory of a green gate. This
repo runs no check automatically; the gate is a dated measurement, not a guarantee. A results
file from three commits ago greps identically to a fresh one, and that is exactly how a
"still passing" claim survives a regression.

`A0_NEGCTL_GREP_DISCRIMINATES` guards the grep pattern itself. Every browser assertion in this
contract is the same shape; if that shape matched anything, all 25 would be theatre.

### 8.1 F23 — status colour

| id | asserts |
|---|---|
| `STATUS_GLOBALS_UNTOUCHED` | `app/globals.css` contains no `--status-` and no `--ring-focus` (static) |
| `STATUS_TOKENS_RESOLVE_LIGHT` | all six literals + three aliases resolve to non-empty values under `.nos-theme` |
| `STATUS_TOKENS_FLIP_ON_DARK` | each alias resolves to a *different* value inside `.nos-on-dark`, and to the declared on-dark literal |
| `STATUS_NO_THEME_LEAK` | the aliases resolve empty on a non-NOS route |
| `STATUS_NONE_AT_REST_390` / `_1280` | zero status-painted elements before the trigger |
| `STATUS_RENDERED_390` / `_1280` | at least one status-painted element after the trigger |
| `STATUS_CONTRAST_390` / `_1280` | every rendered status element ≥ 4.5:1 at the composited pixel |
| `STATUS_TOKEN_IDENTIFIED` | each rendered status element `mixFit`s to a declared status token at `α ≥ 0.98` |
| `STATUS_NO_BRAND_AS_STATUS` | no element bearing `role="alert"` under `.nos-theme` `mixFit`s to `--primary-800` or any brand token (static grep corroborates: no `text-primary-800` / `border-primary-800` remains at the four in-scope sites) |
| `STATUS_HUE_PAIRED` | each pair's two members measure within ±15° of each other (loosened from ±4°; see status-tokens golden §4 — success measures 150.5°/139.0° and is approved). Compare hue only: pair saturation is not asserted equal, success measures 0.50/0.22 |
| `STATUS_SAT_BOUND` | every member's HSL saturation ≤ 0.70 |
| `STATUS_LIGHTNESS_ON_LIGHT` | every on-light member's HSL lightness ≤ 0.40 |
| `STATUS_NEVER_COLOUR_ALONE` | every status-painted element has non-empty visible text or an `svg` / `[data-status-icon]` descendant |
| `STATUS_ERROR_ROLE_ALERT` | the rendered error banner carries `role="alert"` |
| `STATUS_GATED_SITES_FIXED` | static: the two token-gated sites no longer reference brand tokens for status paint |

`STATUS_NONE_AT_REST_*` is the assertion that makes the rest mean anything. Without it,
`STATUS_CONTRAST_*` passes vacuously on a page where the trigger silently failed and there is
nothing to measure — which is precisely the shape of the eight-route latency R8 was written
about.

`STATUS_NO_BRAND_AS_STATUS` is the ruling's actual content (R8/1). Contrast alone does not catch
it: `#1a1445` on `#f3f2d6` measures well over 4.5:1, so today's defective banner would pass a
pure-contrast check while still recolouring itself out of existence on the next palette change.

### 8.2 F24 — focus affordance

| id | asserts |
|---|---|
| `FOCUS_RING_TOKENS_DECLARED` | `--ring-focus-on-light`, `--ring-focus-on-dark`, `--ring-focus` all resolve under `.nos-theme` |
| `FOCUS_RING_FLIPS_ON_DARK` | `--ring-focus` resolves to the on-dark literal inside `.nos-on-dark` |
| `FOCUS_RING_VISIBLE_390` / `_1280` | every focusable control under `.nos-theme` shows a ring in the focused-vs-unfocused raster diff |
| `FOCUS_RING_CONTRAST_390` / `_1280` | every ring ≥ 3:1 against its own adjacent ground, measured per control |
| `FOCUS_RING_OPAQUE` | every ring `mixFit`s at `α ≥ 0.98` — the `/40` defect |
| `FOCUS_IS_OUTLINE` | corroborating: focused elements resolve `outline-width > 0` |
| `FOCUS_NO_BOX_SHADOW` | corroborating: focused elements resolve `box-shadow: none` |
| `FOCUS_ONE_INDICATOR_CARDS` | the card/group sites show exactly one changed band, not two |
| `FOCUS_NOT_CLIPPED` | the ring band is present on all four edges of each control |
| `FOCUS_DARK_GROUND_RING` | the `/national-show` hero CTA's ring clears 3:1 — the R9/3 defect, measured where it actually ships |
| `FOCUS_SHARED_CLASSES_UNTOUCHED` | static: the nine `focus-visible:ring-ink/40` strings still exist unchanged |
| `FOCUS_NOS_OUTLINE_SITES_UNTOUCHED` | static: the five correct NOS outline sites still read `var(--ring-focus)` |
| `FOCUS_NON_NOS_UNAFFECTED` | a control on a non-NOS route still shows its original ring — the reset did not leak |

`FOCUS_SHARED_CLASSES_UNTOUCHED` is a **refusing** assertion: it fails if @dev "fixed" the nine
sites by editing them. That is deliberate. The class strings are shared with SAOC routes this
mission has no mandate over, and the whole design of R9's fix is one scoped reset rather than
nine edits. An assertion that only checks the ring renders correctly cannot tell a scoped reset
from a rewrite that also changed `/tickets`.

`FOCUS_IS_OUTLINE` and `FOCUS_NO_BOX_SHADOW` are marked corroborating on purpose. R9 closes with
*focus is never inspected by reading the stylesheet*, and these read resolved style. They are
kept because they localise a failure fast, and they are explicitly **not** the contrast
measurement — a run where they pass and `FOCUS_RING_CONTRAST_*` fails is a real failure.

### 8.3 Negative controls

| id | asserts |
|---|---|
| `NEGCTL_CONTRAST_DETECTS_FAILURE` | the contrast metric reports < 3:1 for `#7e3f97` on `#1a1445` |
| `NEGCTL_MIXFIT_DETECTS_ALPHA` | `mixFit` reports `α ≈ 0.4`, not 1.0, for a synthesised 40% composite |
| `NEGCTL_RING_DIFF_DETECTS_ABSENCE` | the ring diff reports no ring for an element with `outline: none !important` |

Three metrics, three proofs that each can return the failing answer. This project has already
paid for this lesson once: a passing a11y harness that could not have failed.

## 9. Constraints on the implementation

- **Playwright, headless.** Never `mcp__claude-in-chrome__*` — it raises an interactive
  permission prompt and stalls the session (`.claude/rules/shell-paths.md`).
- **Never `cd`.** Assertion commands run in the gate, and one that prompts cannot run in a gate.
  Inside the project, write paths relative to the project root (the gate's cwd) and name the
  directory rather than a bare `.`; reserve absolute paths for targets outside the project.
  See `.claude/rules/sandbox.md`.
- **Never delete anything under `.tmp/`.** Captures accumulate; that is fine and intended.
- **No multiline `python3 -c` in any assertion command.** They break subprocess shell parsing at
  gate-execution time even when the implementation is correct. Every assertion here is a
  single-line `grep` / `test`, or the one `node_modules/.bin/tsx` driver call.
- **The driver never writes to `app/`.** It reads the running site and writes only to
  `.tmp/sandbox/nos-m8/`.
- **The trigger must not persist data.** `status-tokens.golden.md` §7 shows why the empty-submit
  path is safe: validation precedes the Firestore write.
