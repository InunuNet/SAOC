# Golden — the M4 verifier's contract (revision 2, 2026-09-10)

**Revised for Brad's approved 17-page tree.** Revision 1 targeted a sixteen-new-page tree that
included `/judging-and-awards`, `/plant-exhibition`, `/plant-sales` and `/contact`, and
treated `/sponsors` as link-out-only. That tree is superseded — see
`goldens/m4/route-manifest.golden.md`.

M4 builds six real pages, restructures the hub, reconciles five existing routes, deletes a
route and ships an artifact
another team consumes, so it **carries the full verification triad and must never be added to
any exemption baseline** (`scripts/checks/triad-baseline-exempt.txt` says so in its own text).

---

## Three drivers, three manifests

| script | proves | writes |
|---|---|---|
| `scripts/checks/verify-show-page-m4.ts` | routes, reachability, manifest, seed-write narrowing, visitor-info unification, retired seeds, linkage, sponsors scope, grid function | `.tmp/sandbox/nos-ia/m4-results.txt` |
| `scripts/checks/verify-nos-m4-notice.ts` | `N1`–`N15`, measured on composited pixels at 390 and 1280 via Playwright, plus `G3b` | `.tmp/sandbox/nos-ia/m4-notice-results.txt` |
| `scripts/checks/verify-nos-m4-local-render.ts` | `L1`–`L8` every route rendered on localhost **before push**, plus `S1`–`S4` the untouchable routes' rendered-output snapshots | `.tmp/sandbox/nos-ia/m4-local-results.txt` |

All three live in `scripts/checks/`, **never `execution/`** — that tree is HARNESS-owned and
the next `make update-template` deletes it, taking the gate with it (`.claude/rules/athanor.md`).

All three: exit **0** all passed · **1** a check failed · **2** the harness itself broke,
never collapsed into 1. All three write every id on every run, PASS or FAIL, and exit 2 if any
id is unwritten — a check that silently fails to emit must not be indistinguishable from one
that passed. Manifest lines are two colon-free tokens (`N3 PASS`) so each assertion is an
unquoted grep.

All sandbox paths are **inside the project** (`.tmp/sandbox/`, gitignored) per
`.claude/rules/sandbox.md`. An assertion that prompts cannot run in a gate. Nothing deletes a
sandbox file.

---

## Check ids

### R — routes and reachability · `goldens/m4/route-manifest.golden.md`

| id | check |
|---|---|
| `R1` | every route in the approved tree marked CREATE or RECONCILE has a `page.tsx`; every non-retired seed's `pageKey` maps to exactly one route; the counts hold — 17 listed, **6 created**, **5 reconciled**, 1 restructured, 5 untouchable (`/about` is reconciled, not created — it is deployed) |
| `R2` | untouchable routes unmodified: `tickets/`, `conferences/`, `exhibitors/`, `vendors/`, `archive/`. **No cross-link exception this revision** — the approved tree makes them link *targets*, so nothing needs to change inside them |
| `R3` | **every listed route is reachable by clicking from BOTH surfaces we own** — the hub's four group sections and `ShowSectionNav`'s `SECTION_LINKS`. `components/chrome/nav-config.ts` is **not consulted and must not be**; no assertion may depend on a header entry existing |
| `R4` | a link to `/societies` exists on one of those two surfaces |
| `R5` | no colour, font-family, border-radius or box-shadow literal under `app/(marketing)/national-show/` — regression guard, clean at M1 baseline |
| `R6` | `loadShowPage` returning `null` produces a **404, not an empty page** |
| `R7` | the lane boundary holds — nothing modified under any path in `route-manifest.golden.md` §8 |
| `R8` | `/national-show/upcoming` no longer exists on disk **and no redirect replaces it** — no `upcoming` entry in `next.config.ts` or `middleware.ts` either. Static half of `L5` |

`R3` tightened from revision 1's "at least one of the two surfaces" to **both**. With a flat
six-item header and no dropdown, these two surfaces are the entire navigation for the
subsection; a page on only one of them is one edit from unreachable.

### RM — the route manifest · `goldens/m4/route-manifest-schema.golden.md`

| id | check |
|---|---|
| `RM1` | the manifest validates and cross-checks in **both directions** — disk→manifest, manifest→disk, manifest→golden, `pageKey` resolves, no retired key, every required field present including explicit `null`s |
| `NAV1` | the hub's and `ShowSectionNav`'s **literal** `href` object entries equal the manifest's `listed: true` slugs exactly, in both directions. The literals stay because `site-content-alignment` `A11`/`A12` grep for one of them; the anti-drift property moves from runtime to gate time |
| `RM2` | `app/sitemap.ts` derives its NOS child routes from the manifest: every `indexable: true` row appears in the sitemap output and every `indexable: false` row does not, cross-checked both ways |

### X — the `exhibitors` / `sa-exhibitors` guard · `route-manifest.golden.md` §3

| id | check |
|---|---|
| `X1` | nothing modified under `app/(marketing)/national-show/exhibitors/` |
| `X2` | the two manifest rows state the distinction — `exhibitors.purpose` contains `entry`, `sa-exhibitors.purpose` contains `directory`, both non-empty and unequal, and `04-south-african-exhibitors` resolves to `sa-exhibitors` and no other row |

### H — the hub · `goldens/m4/hub-groups.golden.md`

| id | check |
|---|---|
| `H1` | four groups, exact ids and labels, in order; all 16 child pages present, each in exactly one group, link text equal to its manifest `label` |
| `H2` | each group is a `<section>` with an accessible name matching its heading, heading ahead of its links in document order |
| `H3` | the hub's pre-M4 rendered text runs all still render — the groups are added structure, not a replacement for the show's own copy |

### SP — sponsors have their own data scope · `route-manifest.golden.md` §6

| id | check |
|---|---|
| `SP1` | `showSponsor` document type exists and is registered in the schema index, with its own fields |
| `SP2` | nothing under `app/(marketing)/national-show/sponsors/` or its data helper references `_type == "sponsor"`, `sponsorsQuery` or `allSponsorsQuery` |
| `SP3` | `app/(marketing)/sponsors/` is unmodified |
| `SP4` | the empty state satisfies the real-empty-listing rule (see EL below) |

### EL — real empty listings · `route-manifest.golden.md` §5

| id | check |
|---|---|
| `EL1` | with zero records, `/sa-exhibitors`, `/international-guests` and `/sponsors` each render their heading, their intro, **the shape of the coming card** (the field labels the record will carry), and the absence stated in words including what will appear and when |
| `EL2` | the string `no results` (case-insensitive) appears on none of the three; nor does `coming soon` as the block's only statement |
| `EL3` | **zero invented entities.** Every capitalised multi-word phrase in the three pages' prose is in `content/show-pages/_name-allowlist.json`. An invented nursery or sponsor is an invented commercial relationship with a real business, and no disclosure mitigates it |

### RS / CL — retired seeds and the linkage defect · `goldens/m4/retired-seeds.golden.md`

`RS1`–`RS4` and `CL1`–`CL5` as specified there. **`CL5` is new at revision 3** and closes the
direction the linkage check never covered — a `council-supplied` seed section that silently
*omits* source content the live route already renders. It was found on
`02-about-the-national-show.json`, which holds 1,372 characters of a 2,587-character source
that the deployed `/about` page renders in full. The resolution is always to complete the seed
from the source, never to trim the page to match the seed.

 **`RS3` and `CL3b` are the load-bearing
ones**: `RS3` proves retirement moved and relabelled rather than quietly edited or dropped
content; `CL3b` proves the linkage threshold was not honoured in letter (`= 25`) while the
comparison itself was loosened to match anything.

The corpus deliberately splits: route/seed resolution sees `content/show-pages/*.json` top
level only, linkage and provenance see `content/show-pages/**` **including `retired/`**, so
retiring a file cannot launder a failing section.

### G — R13, the grid orphan rule · `goldens/m4/grid-orphan-rule.golden.md`

| id | check |
|---|---|
| `G1` | `resolveGridLayout(n)` matches the golden table for `n` 0..40 — **both** `columns` and `finalCardSpans`, including the spanning cases at n = 13, 25, 37 |
| `G2` | the string `grid-cols-` appears in **zero** files across the surfaces M4 builds — the hub, the six created routes plus `about/`, `ShowSectionNav.tsx`, `components/show/nos/` — `lib/grid-columns.ts` excepted. Scope narrowed deliberately: a subsection-wide grep would demand edits inside the untouchable trees, putting `G2` in direct conflict with `R2`/`X1`. The deferrals are named in the golden |
| `G3a` | `COLUMN_CLASS` has exactly four entries mapping 1..4 to complete Tailwind class names |
| `G4` | **never a partial row** — the final item's column span fills its row |
| `G5` | **never a centred lone card** — a spanning card's left edge is the grid's content-box left edge; passes `G4` and still wrong, which is why it is separate |
| `G6` | R13 binds at `c >= 3`; **`c = 2` is exempt by ruling**, asserted on the helper's search floor so neither extending nor abandoning the rule can pass silently |
| `G3b` | **browser-measured**: each hub group's computed `grid-template-columns` track count equals `resolveGridLayout(memberCount).columns` — expected 4, 3, 4, 3 |

`G2` alone passes if the helper's return value is computed and ignored. `G3b` alone passes if
a literal happens to be right for today's count. Both, or neither is worth having.

### S — the untouchable routes, proved by rendered output rather than by paths

| id | check |
|---|---|
| `S1` | normalised rendered output identical to a pre-M4 baseline, for every identity-constrained route. Normalisation is DOM text + link hrefs + heading structure, with time-dependent content normalised away; **the driver fails loud if a route normalises to empty**, because a snapshot of nothing matches everything |
| `S2` | `/national-show/exhibitors` is still the grower entry guide at its own slug, rendering no nursery-directory fields. `S1` proves the output did not change; `S2` proves it is still the **right page** — a snapshot alone passes if someone repoints the route *and* regenerates the baseline |
| `S3` | each baseline's git blob is unchanged since the mission base ref. Without it, `S1` compares the tree against a copy of itself taken after the change — the trap `site-content-alignment`'s `A10` names in its own description |
| `S4` | no baseline was regenerated to resolve the `G2`/`S1` collision quietly (see `D92`) |

**All browser measurement is headless Playwright.** `.claude/rules/shell-paths.md` forbids
Claude-in-Chrome in this project — it raises an interactive permission prompt, and an assertion
that can stop on a permission modal is theatre, not verification. `D94` asserts no driver
references it.

### SW — the seed may never overwrite a council-authored field

`SW1`–`SW5` unchanged, per `seed-write-narrowing.golden.md`. `SW5` remains load-bearing: a
fixture section edited in each of the four seed-owned fields, and one flipped to
`council-supplied`, all survive a re-run byte-identical.

### V — visitor-info mechanism unification

`V1`–`V5` unchanged, per `visitor-info-unification.golden.md`. **`V4` pins
migration-before-tightening** — reversed, every document with an unset block becomes
unpublishable and the secretary is blocked mid-edit on content that is not hers to decide.

### CD — the fourth provenance value

`CD1`–`CD5` unchanged, per `council-draft-provenance.golden.md`.

### N — the disclosure, measured in a browser

`N1`–`N10` per `notice-visibility.golden.md`, unchanged. `N11`–`N15` per
`goldens/m4/r11-disclosure.golden.md` — the chip/sentence/rail form, the token rule
(never error/red), and R12's no-second-nav boundary.

**Prerequisite, still outstanding:** `--status-muted-on-dark` must be declared in
`nos-theme.css`. A ruled value reads as a shipped value; it is stated here as outstanding
work, not as done.

### L — local render, before push

`L1`–`L8` per `goldens/m4/local-render.golden.md`. `L2` (the page's own `<h1>`), `L4` (zero
console errors), `L5` (a **3xx fails**) and `L7` (crawled links, not source-read) are the four
that a file-existence check cannot reach.

---

## The triad, and how each part is honestly satisfiable

`target:` for all three kinds, **never `command:`** — `contract.py` reads `target:` and ignores
`command:`, which is how M1's A39 came to review nothing while reading as fully populated.
`D33` guards that all three carry a non-empty target.

| kind | how M4 satisfies it without fabricating |
|---|---|
| `codex_qa` | a prompt string; reviews the M4 diff |
| `browser_deployed_check` | a manifest naming real pages on the deployed origin, `commit_sha` equal to HEAD, non-empty screenshots, and an `http_status` the wrapper re-fetches live. Six new pages plus a restructured hub is exactly what this check is for |
| `gws_inbox_check` | **see the honest problem below** |

### The `gws_inbox_check` no longer has a subject, and that is stated rather than faked

Revision 1 satisfied it through spec entry 18's contact page: a POPIA-consented form on
`/national-show/contact` reusing `/api/contact` → Resend, so a test submission produced a real
email `gws mail read` could verify.

**Brad's approved tree deletes that page.** No route M4 owns wires a form that sends mail.
`/national-show/vendors/apply` does — and it is the `saoc-eb` lane's, untouchable, and not
part of this diff.

The golden's own rule from revision 1 applies directly: *"if the page ends up linking to the
site-wide `/contact` instead, this check has nothing to verify — and the right response then
is to say so and ask, never to point the manifest at an unrelated email."*

So: **`D32` is declared `blocked`, with its reason recorded, and is not satisfied by pointing
at an unrelated inbox.** Pointing it at `/api/contact` on the site-level `/contact` page would
verify the *other lane's* form and prove nothing about M4. This needs the lead's ruling:
either M4 is exempt from `gws_inbox_check` because it wires no mail path, or a mail path is in
scope and the tree needs one — which is a structural decision, not an architect's.

The two remaining triad kinds are unaffected and both run.

## What M4's verifier does not prove

- **That the disclosure is *understood*.** `N1`–`N15` prove it is perceivable and that the
  rail shows the extent. Brad's word was *unmistakable*, which is higher, and no automated
  check reaches it. One page, one person who has not seen it, before launch.
- **That the copy is any good.** M3's prohibitions keep it from being harmful; nothing here
  measures whether it reads as a plausible draft.
- **That the FAQ answers are right.** Blocked upstream on a truncated Drive `.docx`. M4
  reconciles the page and writes no answers.
- **That the deployed origin matches this commit beyond `commit_sha`.**
- **That the `saoc-eb` lane consumes the route manifest correctly.** We assert the manifest is
  right; nothing asserts they read it.
- **Anything about M2's entity model**, which is deferred.
