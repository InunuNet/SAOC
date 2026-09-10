# Golden — the M4 verifier's contract

M4 builds sixteen real pages on a deployed origin, so unlike M1 and M3 it **carries the full
verification triad and must never be added to any exemption baseline**
(`scripts/checks/triad-baseline-exempt.txt` says so in its own text). A browser check is not
optional here; it is the only thing that can prove the work.

**Navigation note:** `goldens/m4/route-manifest.golden.md` supersedes `goldens/m1/route-map.golden.md`'s
Navigation section, which named `nav-config.ts` as an acceptable surface. Site chrome is now
off-limits — the route map is frozen while M1's gate is red and is queued for correction.

## Two drivers, two manifests

| script | proves | writes |
|---|---|---|
| `scripts/checks/verify-show-page-m4.ts` | routes, nav reachability, seed-write narrowing, visitor-info unification — all static or fixture-driven, no browser | `.tmp/sandbox/nos-ia/m4-results.txt` |
| `scripts/checks/verify-nos-m4-notice.ts` | N1–N10, measured on composited pixels at 390 and 1280 via Playwright against its own dev server | `.tmp/sandbox/nos-ia/m4-notice-results.txt` |

Both live in `scripts/checks/`, never `execution/` — that tree is HARNESS-owned and the next
`make update-template` deletes it, taking the gate with it.

Both: exit **0** all passed · **1** a check failed · **2** the harness itself broke, never
collapsed into 1. Both write every id on every run, PASS or FAIL, and exit 2 if any is
unwritten — a check that silently fails to emit must not be indistinguishable from a defect.
Manifest lines are two colon-free tokens (`N3 PASS`) so each assertion is an unquoted grep.

## Check ids

### R — routes and reachability

| id | check |
|---|---|
| R1 | Every route in `route-map.golden.md` marked CREATE or RECONCILE has a `page.tsx`, and every seed source's `pageKey` maps to exactly one route |
| R2 | Untouchable routes unmodified: `tickets/`, `vendors/`, `archive/`, `upcoming/`. `conferences/` and `exhibitors/` keep their routes and content but may gain a cross-link |
| R3 | **Every created route is reachable by clicking, from the two surfaces we own** — the `/national-show` hub's quick links or `components/show/ShowSectionNav.tsx`'s `SECTION_LINKS`. **`components/chrome/nav-config.ts` is not consulted and must not be** — site chrome belongs to the main-site lane, and no assertion may depend on a header entry existing. `/national-show/archive` returned 200 for months with nothing linking to it; this codebase has already paid for that |
| RM1 | **The route manifest lists exactly the routes that exist**, cross-checked in both directions against `page.tsx` files on disk and `route-map.golden.md` — see `route-manifest.golden.md`. Every row has a non-empty `label`, a `parent`, and a `pageKey` resolving to a real seed source |
| R7 | `components/chrome/` is unmodified — the cross-lane boundary, pinned |
| R4 | A link to `/societies` exists on one of the two surfaces we own — not in site chrome |
| R5 | No colour, font-family, border-radius or box-shadow literal under `app/(marketing)/national-show/`. Verified clean at M1 baseline, so this is a regression guard |
| R6 | `loadShowPage` returning `null` produces a **404, not an empty page**. An empty page reads as a finished page with nothing to say |

### SW — the seed may never overwrite a council-authored field

Full rules in `seed-write-narrowing.golden.md`. SW1–SW5 as specified there. SW5 is the
load-bearing one: a fixture section edited in each of the four seed-owned fields, and one
flipped to `council-supplied`, all survive a re-run byte-identical.

### V — visitor-info mechanism unification

Full rules in `visitor-info-unification.golden.md`. V1–V5 as specified there. **V4 pins the
migration-before-tightening order** — reversed, every document with an unset block becomes
unpublishable and the secretary is blocked mid-edit on content that is not hers to decide.
V5 proves no structured field was lost, which is the whole argument for keeping the documents
split.

### N — the placeholder notice, measured in a browser

N1–N10 in `notice-visibility.golden.md`. Measured on **composited pixels at 390 and 1280**,
never from the stylesheet: a computed style can be correct while the rendered result is not.

Two that a purely visual review would not catch: **N5** (non-dismissible — no control, no
`localStorage` suppression on a second load) and **N6** (real DOM text, not a pseudo-element,
reachable before the body copy).

**N10** — research contrast strictly below placeholder on any ground — protects the meaning
rather than the number. Every per-token check passes with the hierarchy inverted.

**Prerequisite:** `--status-muted-on-dark: #a49dbe` must be declared in `nos-theme.css`. It
does not exist yet. A ruled value reads as a shipped value, so this is stated as outstanding
work, not as done.

## The triad, and how each part is honestly satisfiable

`target:` for all three kinds, never `command:` — contract.py reads `target:` and ignores
`command:`, which is how M1's A39 came to review nothing while reading as fully populated.
Guarded by the target-present check, now covering all three kinds.

| kind | how M4 satisfies it without fabricating |
|---|---|
| `codex_qa` | a prompt string; reviews the M4 diff |
| `browser_deployed_check` | a manifest naming a real page on `https://beta.saoc.co.za`, with `commit_sha` equal to HEAD, a non-empty screenshot, and an `http_status` the wrapper re-fetches live. M4 deploys sixteen pages — this is exactly the milestone the check was built for |
| `gws_inbox_check` | **entry 18's contact page reuses the existing `/api/contact` → Resend flow** (spec 4.18 requires a POPIA-consented contact form on that page), so a test submission produces a real email whose arrival `gws mail read` verifies |

The `gws` case is worth stating plainly: it is satisfiable **because M4 wires a real form**,
not because a manifest can be written. If the contact page ends up linking to the site-wide
`/contact` instead of carrying a form, this check has nothing to verify — and the right
response then is to say so and ask, not to point the manifest at an unrelated email.

## What M4's verifier does not prove

- **That the notice is *understood*.** N1–N10 prove it is perceivable. Brad's word was
  *unmistakable*, which is higher, and no automated check reaches it. One page, one person
  who has not seen it, before launch.
- **That the copy is any good.** M3's prohibitions keep it from being harmful; nothing here
  measures whether it reads as a plausible draft.
- **That the deployed origin matches this commit beyond `commit_sha`.** The browser check
  re-fetches live and compares HEAD, which proves the page exists at that commit — not that
  every pixel in the screenshot came from that build.
- **Anything about M2's entity model**, which is deferred. Pages 4, 5, 11 and 12 render M3's
  prose; 8 and 15 render real listings from the existing `sponsor`/`award`/`judge` types.
