# F2 — NOS page-wide design deltas (Codi, 2026-09-29)

Source (verbatim): `.agent/memory/scratch/rulings-inbox/codi-page-deltas-2026-09-29.md`,
9 items, "rulings file wins where they differ." That file was appended to live during
this architect pass with a same-day HOLD update — see §0. Rulings cited: R10-R23,
especially R13, R14, R21/8, R22, R23, in
`.agent/memory/project/design/nos-design-rulings.md`.

Scope: this feature touches the ~26 non-menu routes under
`app/(marketing)/national-show/**` (every route `app/(marketing)/national-show/layout.tsx`
renders), plus their shared components under `components/nos/` and `components/show/`.
`components/chrome/**` and `nav-config.ts` (SAOC chrome, the menu lane) are **not
touched** by this feature.

## 0. HOLD / FINAL — item 1 (fonts) and the lockup's mobile geometry

The rulings-inbox file changed twice, live, mid-pass, after the original 9-item
batch — a "HOLD update," then a same-day "Corrections from Codi" that
supersedes the HOLD update where the two differ. **Final F2 scope after both:
items 2, 3, 4, 5, 6, 7, and 9. Items 1 and 8 are out (recorded in this
contract's top-level `exclusions:` field, not as gate assertions).**

### Item 1 (font remap) — HOLD, stands

> HOLD item 1 (fonts). ... Brad pointed to the committee-approved identity
> "National Orchid Show 2027 Logo.pdf" ... which specifies Cormorant Garamond
> display + Jost UI/body — conflicts with R14. Do not touch font tokens until
> Brad rules.

Read the PDF directly (it is in this project's tree:
`branding/National Show 2027/National Orchid Show 2027 Logo.pdf`, 14 pages) to
confirm the conflict is real rather than taking it on faith:
- **p.6 "Typography":** "Two faces, both open-licensed... Display & wordmark:
  Cormorant Garamond [weights 400-500]... UI, labels & body: Jost [weights
  300-600]... Montserrat, which belonged to the retired badge logo, is no
  longer part of the system." No Fraunces, no Karla, anywhere in the document.
- **p.1:** "The wordmark, location line and geometry are unchanged from the
  July 2026 approval" — i.e. this is presented as a standing, already-approved
  identity, not a draft.

This squarely conflicts with R14 ("Cormorant Garamond and Jost are reserved to
the wordmark... Display is Fraunces... Body is Karla"). **Do not remap
`nos-theme.css`'s `--font-serif`/`--font-sans` (lines 120-123). Do not touch
the Fraunces/Karla font loads in `layout.tsx`. Do not stop loading Cormorant
Garamond or Jost.** No assertion in this contract touches any font token.

Findings recorded here so the next pass does not have to re-derive them:
- `components/nos/Logo.tsx`'s old hand-typeset wordmark (`font-serif`/`font-sans`
  utility classes) is retired anyway by §2 below (R23) — replaced by placed artwork
  that carries no Tailwind font utility at all. That change is unaffected by the HOLD:
  it ships regardless of which face `--font-serif` eventually resolves to, because the
  lockup is an image, not text.
- `components/nos/NosHero.tsx:299` (the non-display `<h1>`, used by the other eleven
  heroes) reads `font-[family-name:var(--font-nos-cormorant)]` **directly by variable
  name**, bypassing the `font-serif` utility on purpose — a workaround so F1's
  A17 grep (`! grep -q "font-serif"`) would pass while the rendered font stayed
  Cormorant. This is exactly the kind of "logo font used elsewhere" usage R14
  objects to, and exactly the kind of usage the committee PDF conflict is about.
  **Leave it exactly as it is.** Do not convert it to `font-serif` and do not
  touch it for any other reason in this feature — touching it is item 1's territory,
  not F2's, whichever way Brad rules.
- Net effect: **F2 ships zero font-family changes.** Every item below is size,
  colour-application, structure, ordering, or asset-placement — never a font swap.

### Mobile lockup geometry — FINAL as built, not merely on hold

The HOLD update initially read the PDF's clear-space rule as a reason to
freeze *all* lockup geometry pending Brad. Codi's follow-up correction settles
it more specifically and more permanently:

> The mobile lockup geometry stays EXACTLY as built, and that is final rather
> than on hold. The 10 Sep Logo folder files supersede the PDF's lockup
> geometry. The F1 geometry assertions stay as they are.

The PDF's relevant rule, for context (**p.8, "Clear space and minimum
size"**): "Clear space on all four sides equals one quarter of the emblem
width, measured from the outermost petal tips and the ends of the location
line. Nothing sets inside it." RESUME.md's own open item (F1's mobile hero
lockup measuring less clearance than this formula would want at 390px) is
exactly what this rule would flag — and Codi has now ruled that the **10 Sep
`branding/National Show 2027/Logo/` files' own proportions govern, not this
PDF's clear-space formula.** F1's hero geometry (contract-f1.yaml's A23-A29,
`placement-spec.md`) is unchanged by F2 and this contract adds no assertion
that touches it.

**This also settles how far I read the PDF for §2/R23 below.** I did not use
the PDF's p.8 clear-space formula to size the new masthead/colophon
placements — that would be applying exactly the superseded authority Codi
just rejected. `f2-logo-lockup.md`'s masthead (96px) and colophon (120px)
widths come from R21/8's rendered-width table instead, which is itself a
measurement of the same 10-Sep supplied files' actual legibility — consistent
with, not contrary to, this ruling.

## 1. Hero photo priority — already shipped, regression-only

Item 3 (LCP): `components/nos/NosHero.tsx` already accepts and forwards a `priority`
prop to `next/image` (line ~73/113), and the `/national-show` hero call
(`app/(marketing)/national-show/page.tsx`, the `<NosHero image="/images/orchid-dark.jpg"
priority ...>` call) already passes it. Next's `priority` prop sets `fetchpriority="high"`
and disables lazy-loading on its own — **no code change needed.** Assertion is
regression-only: prove a future edit cannot silently drop it.

## 2. Type floor — no NOS text below 12px (Codi item 4)

**Confirmed by Codi as the literal rule ("Codi answers," 2026-09-29): all
~30 spots at 10px, 10.5px and 11px get raised** — my original reading (below)
of "no NOS text below 12px" as controlling over the narrower "16 labels at
10-10.5px" count was correct, and is no longer a discrepancy to flag, it's
settled.

**One exception, also from Codi's answer: the hero `dt` goes to 12.8px via a
new `--fs-xs` token, not to flat 12px like everything else.** Correction to my
own earlier note: I previously wrote the hero `dt` as `text-[11px]`; rereading
`app/(marketing)/national-show/page.tsx`'s actual hero `<dl>` markup (~line
531-541, the `data-nos-hero-text="meta-dt-{index}"` element) shows it is
`text-[10px]`, not 11px — the 11px instance I'd cross-referenced
(`components/show/ShowCountdown.tsx`'s unit labels, and a `text-[11px]` at
`page.tsx` ~line 650 that belongs to a different section, not the hero `dl`)
is a separate element and follows the flat-12px rule below, unaffected by
this exception.

`--fs-xs` does not exist anywhere in the codebase yet (checked: no `--fs-*`
token of any name is declared in `nos-theme.css` or `app/globals.css`) — Codi
is introducing it now, from her own design-system canvas, not something to
find already in this repo. Add it to `nos-theme.css`'s `.nos-theme` scope
block as `--fs-xs: 0.8rem;` (= 12.8px at the default 16px root, confirmed no
root font-size override exists in `globals.css`), and change the hero `dt`'s
className from `text-[10px]` to `text-[length:var(--fs-xs)]` — a token
reference, not a new literal bracket, so it reads distinctly from the flat-12px
sweep below and a future gate can tell the two fixes apart.

**Everything else: every remaining `text-[10px]`, `text-[10.5px]` and
`text-[11px]` literal inside `components/nos/`, `components/show/` and
`app/(marketing)/national-show/` becomes `text-[12px]`** (0.75rem) — this now
includes `ShowCountdown.tsx`'s unit labels and every other sub-12px label
found in the original sweep. Tracking/letter-spacing, weight, colour and case
are untouched — only the size literal changes (or, for the hero `dt` alone,
the size source). `font-mono` labels (countdown units, eyebrow2, table
captions) and `font-sans`/`font-serif` labels are both in scope; this is a
size floor, not a face change (see §0 — no font changes ship here).

**Checked against the font HOLD explicitly — not blocked by it.** A `text-[Npx]`
literal is a size, independent of which font-family the surrounding
`font-serif`/`font-sans`/`font-mono` utility resolves to today or after Brad
rules on item 1. Nothing in the committee PDF (p.6, "Typography") sets a
competing size floor either — it gives body a 15-17px *range*, not a ceiling
or a floor that a 12px label would violate, and says nothing about label
sizes at all. This item ships regardless of item 1's outcome.

**Excluded, verify before changing:** `components/show/_shared/StatusMarker.tsx`'s
`text-[10.5px]` (line ~118) — confirmed by a repo-wide grep to have no call site
outside `components/show/ExhibitorStatusBadge.tsx` and
`components/show/ConfirmationBadge.tsx`, both NOS-scoped, so it is in scope and
gets the same fix. (Recorded so a future pass doesn't have to re-check this.)

**Body copy is already compliant.** Every body paragraph found in this tree is
already `text-[16px]` or larger (`font-sans text-[16px] leading-relaxed`
throughout `about`, `what-to-expect`, `faq`, `plan-your-visit`, etc.) — no
change needed there; this is a regression fact, not a fix.

**Re-run the contrast gate after** (Codi's own instruction): the hero `dt` and
the countdown units both carry `data-nos-hero-text` hooks already wired into
`scripts/checks/nos-hero-contrast.mjs` (F1, hero-structure.md §10). A size
change never changes colour or the composited background, so this is not
expected to regress the floor, but the script is cheap to re-run and the
ruling asks for it explicitly — carry it as an assertion (§ contract A-list).
This now also has to catch a `--fs-xs`-token size (the hero `dt`) alongside
the flat-12px sweep everywhere else — the script walks whatever
`[data-nos-hero-text]` elements are present regardless of how their size is
set, so no script change is needed for this, only the re-run.

## 3. Touch targets — 44×44 CSS px (Codi item 5)

**The three CTAs** are `components/nos/Button.tsx`'s three variants as currently
rendered in the hero (`app/(marketing)/national-show/page.tsx`'s "Book tickets",
"Register interest", "Find your society" — see §4). `Button.tsx`'s current box is
`py-3` (12px) + `text-[15px] leading-none` (15px line box) = **39px tall**, 5px short
of the floor. `Button` is the **one shared component** behind every button on
every NOS/show page — not just these three — so the fix is made once, in
`Button.tsx`'s base class list (`min-h-[44px]`), not per call site. This is a
WCAG touch-target floor; widening it beyond the three named CTAs is correct,
not scope creep.

**The two icon buttons — identified, out of scope for F2.** Codi's answer
(rulings-inbox, "Codi answers") resolves the open question I raised above:
the two elements the audit means are the SAOC header's search and hamburger
controls, both in `components/chrome/**`. My repo-wide search had correctly
found nothing under `components/nos/`, `components/show/`, or
`app/(marketing)/national-show/` because they aren't there — they're SAOC
chrome, not a NOS component. `components/chrome/**` is explicitly off-limits
to this mission (menu lane's territory, per the F2 dispatch), so these are
**dropped from F2 entirely**. Codi is flagging them to the menu lane
directly; no F2 assertion is written for them, and none should be — fixing
them here would be scope leakage into another lane's surface, not a fix.
The three CTAs (above) are unaffected by this and remain in scope, fixed
once in `Button.tsx`.

## 4. Hero button order + emphasis (Codi item 7)

Current (`app/(marketing)/national-show/page.tsx`, hero `actions`): Book tickets
(`on-dark`, filled/primary) → Register interest (`ghost-on-dark`) → Find your
society (`ghost-on-dark`), in that markup order.

**Target (the mock's order, ships now; Brad may reverse it — see below):**
Register interest (`on-dark`, filled — becomes primary) → Find your society
(`ghost-on-dark`) → Book tickets (`ghost-on-dark`).

Only the `variant` prop and JSX order change. The `data-nos-hero-text` hook
strings (`btn-register-label`, `btn-societies-label`, `btn-primary-label`) stay
exactly as they are — hero-structure.md §10 says these labels are "used only
for the script's own report table, not asserted on by name," so there is no
correctness reason to rename `btn-primary-label` now that Register, not Book
tickets, is primary. Renaming them is optional cosmetic tidiness, not required.

**Flagged, not blocking:** Codi's note says Brad may reverse this order.
If he does, it is a one-line JSX reorder (no variant changes) — do not treat a
later reversal as a new feature.

## 5. DROPPED — item 8 (hero `dl` hairline)

Originally specified as a swap from the current
`border-l-[length:var(--border-primary)] border-[var(--olive)]/50 pl-4` (hero
meta `dl`, each item's wrapper `div` in `app/(marketing)/national-show/page.tsx`)
to a neutral ivory-at-20%-alpha hairline, on the premise that the brand guide
bans a coloured left-border accent stripe outright.

**Codi's "Corrections from Codi" withdraws this:**

> DROP item 8. The olive dl rules stay; the committee identity names olives
> as "accents for rules". Do not specify the hairline, and remove any
> assertion for it.

Confirmed directly against the PDF, **p.5 "Palette":** "Royal purple is the
primary ink and carries all type; **the two olives are accents for rules**,
location lines and small marks; pale gold is the paper ground." The olive
left-rule on the hero's meta `dl` is exactly this — an olive accent on a rule
— so it is compliant with the committee identity as written, not a violation
of it. (Separately, p.7 "Surfaces" does say "never a coloured left-border
stripe," but that line is scoped to the 10px-radius *card* misuse example on
that page, not to a `dl`'s hairline rule — a different surface, and not what
Codi is ruling on here regardless.)

**No change ships.** `page.tsx`'s hero `dl` markup is untouched by this
feature.

**Regression guard added, per the team lead's instruction** ("Add an
assertion that the olive rule is still present, so nobody removes it"): a
DROPPED item still needs a positive assertion when a later, unrelated edit
to the same file could delete it by accident — item 2's type-floor sweep and
item 4's button reorder both touch this same block of `page.tsx`. The
contract therefore carries a new check confirming
`border-[var(--olive)]/50` is still present on the hero `dl` wrapper, so a
future pass that strips it (even inadvertently) fails the gate rather than
shipping silently. This is the one assertion this dropped item gets, and it
guards the status quo, not a change.

## 6. "Coming to the show" grid — R13 orphan (Codi item 6)

`app/(marketing)/national-show/page.tsx`'s `VISITOR_CARDS` array (5 entries,
line ~258) renders into a **hardcoded** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
(line ~661) — the one card grid in this file that does not go through
`lib/grid-columns.ts`'s `resolveGridLayout`/`COLUMN_CLASS`, which every other
grid in this codebase (the judging grid two sections below in the same file,
`NosHubGroup`, `AccommodationList`, `TravelRoutes`, `ShowEntityGrid`,
`ShowSectionNav`) already uses. `resolveGridLayout(5).columns === 3` (5 mod 4
= 1 fails the orphan rule; 5 mod 3 = 2 holds), so this is a straight port to
the existing pattern, not a new algorithm:

```
const visitorGridLayout = resolveGridLayout(VISITOR_CARDS.length);
...
<ul className={`mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 ${COLUMN_CLASS[visitorGridLayout.columns]}`}>
```

`COLUMN_CLASS` and `resolveGridLayout` are already imported in this file
(line 12, for the judging grid) — no new import needed. `sm:grid-cols-2` is
untouched (R13/5: the rule is tolerated at `c = 2`).

**Checked and out of scope — recorded so it isn't re-litigated:** this file
has two other hardcoded grids, `EXHIBITOR_STAGES` at `lg:grid-cols-4` (line
~770) and `pastShows.slice(0, 6)` at `lg:grid-cols-3` (line ~805).
`EXHIBITOR_STAGES` has exactly 4 entries — `n = c`, exempt by R13/3, not a
violation. `pastShows` is data-dependent (0-6 items behind a `length > 0`
guard) and *could* orphan at some counts (e.g. 4 items in 3 columns), but
Codi's delta names only "Coming to the show," and sweeping every grid in the
file is a separate, unscoped R13 audit — not this feature. Flagged for a
future pass, not fixed here.

## 7. P0 paint check — CLOSED 2026-09-29 (Codi F2 review)

**Superseded.** Everything below the "Update — CLOSED" note is the diagnosis
procedure as it stood before Codi's F2 review closed the item; kept for the
audit trail (the diagnosis procedure and the gating script it specified were
both legitimate work — the finding was that the *cause* was environmental,
not that the investigation was wrong to run).

**Update — CLOSED, per Codi's F2 review:** the source of the 6/7 and 7/8
misses was Codi's own review agents loading the page through
claude-in-chrome extension tabs, which were likely unfocused — Chrome skips
paint work in background tabs, which is exactly the "background-tab paint
artefact" theory the original audit raised and Codi's own second report had
provisionally set aside. Foreground evidence is now 16/16 (Codi's own
re-check) plus this feature's own paint-probe script (below), which is
stronger evidence than the extension-tab reproductions were. **Do NOT add a
`sizes` attribute to the mobile `<source>`** on the strength of candidate
cause 2 below — Codi's review states plainly that it "defaults to 100vw;
adding changes nothing" for this element, closing that lead as a red
herring, not a fix. No production code changes ship for item 9.

**The gating paint-probe script stays** (`scripts/checks/nos-hero-paint-probe.mjs`,
spec below) — the escalation to a real gate was correct regardless of root
cause, and a script that would have caught the artefact either way is worth
keeping. It is a regression guard now, not a diagnostic pending a fix.

Original audit: "h1 lockup failed to paint in 6/7 automated loads... likely
background-tab paint artefact." **Update from Codi (superseded, see above):**
it reproduced again — a cold, foreground load at 1280 on
`localhost:3002/national-show`, 7 of 8 automated loads at the time. That
report is what escalated this to a gating assertion; the escalation stands
even though the root cause turned out to be the reviewing tool, not the page.

### Diagnosis procedure (dev)

Reproduce with Playwright, **not headless** (a real foreground tab — the
original artefact theory was background-tab throttling, and Codi's own
reproduction was already foreground, so this alone won't explain it, but keep
the condition controlled) and **cache disabled** (`context.route` or CDP
`Network.setCacheDisabled(true)` — a cold load, not a warm one from a shared
profile), at **1280×900 and 390×844**. Per load, capture and log:
- the lockup `<img>`'s `.complete` and `.naturalWidth`, and its `.currentSrc`
  (which candidate the browser actually picked);
- the network request for the lockup PNG (issued at all? status? timing —
  did it start, finish, ever get cancelled?);
- whether the `<h1>`'s box is actually painted (screenshot the element, confirm
  it isn't a uniform blank/transparent fill — the paint-probe script below is
  this same check, made permanent).

### Candidate causes to check — not conclusions, verify each empirically

1. **`loading`/`fetchPriority` on the `<picture>`'s `getImageProps` output.**
   `HeroLockup()` (`page.tsx` ~line 122) passes `priority: true` into both
   `getImageProps` calls, which should set `loading="eager"` +
   `fetchPriority="high"` — check the *rendered* `<img>` attributes match what
   the code implies; don't assume the prop reached the DOM correctly.
2. **A `<source>`/`sizes` mismatch — CLOSED, do not fix.** Codi's F2 review
   checked this exact lead directly and ruled it out: a `<source>` with no
   `sizes` "defaults to 100vw; adding changes nothing" for this element. Left
   below for the record of what was checked; **do not add `sizes` to the
   mobile `<source>`.** The mobile `<source>` element
   (`page.tsx` ~line 145: `<source media="(max-width: 620px)" srcSet={mobileSrcSet}
   width={3272} height={2876} />`) carries **no `sizes` attribute at all** —
   `getImageProps`'s vertical call (~line 127-133) was given `sizes: '365px'`,
   but only `srcSet` was destructured out of its return value; `sizes` was
   dropped on the floor. Per the HTML spec, a `<source>` with a width-descriptor
   `srcset` and no `sizes` defaults to `100vw` for candidate selection, which
   is a real, verifiable divergence from what the code intends — but confirm
   with the network-request check above whether this actually produces a
   missing/slow/failed load in the failing case, rather than assuming it's the
   cause because it's the easiest thing to spot.
3. **`decoding`.** Check the rendered `decoding` attribute (Next normally sets
   `async`) and whether an async decode is somehow racing the screenshot/paint
   check in a way a sync decode wouldn't.
4. **Opacity/visibility during hydration.** Check computed `opacity`/`visibility`
   on the `<picture>`/`<img>` across the hydration window — nothing in
   `HeroLockup()`'s own JSX sets either, so if this is a factor it's coming
   from somewhere else (a global CSS rule, a Next streaming/suspense boundary).
5. **`next/font`/CSS swap timing.** Check whether a font-swap repaint
   (`document.fonts.ready` timing) interacts with the image paint — the hero
   also loads Fraunces/Karla/Cormorant/Jost, and a FOUT/FOIT swap repainting
   the whole hero at the wrong moment is a plausible interaction even though
   the lockup itself is an image, not text.

**Add a fix only if the diagnosis reproduces and identifies a mechanism.** Do
not ship a speculative fix (e.g. adding `sizes` to the `<source>` on the
theory alone, without confirming it changes the reproduction rate) — verify
first per behavior.md's "never assert without verification."

### Gating assertion — `scripts/checks/nos-hero-paint-probe.mjs` (dev writes)

Reuses `scripts/checks/nos-hero-contrast.mjs`'s Playwright setup (F1,
hero-structure.md §10) rather than inventing new tooling:
- Resolve target the same way (`NOS_HERO_CONTRAST_URL`, same reachability
  probe/SKIP-as-fail convention).
- At **1280×900** and **390×844**, each with **cache disabled** and a fresh
  browser context per load (a real cold load, not a warm reuse): run **N=8**
  loads per viewport (matching Codi's own sample size). Per load, wait for
  `document.fonts.ready` and the lockup `<img>`'s `naturalWidth > 0`, then
  screenshot the `<h1>` box and confirm it is not a uniform blank/transparent
  fill.
- Print the table (viewport | load # | painted yes/no | `currentSrc` |
  network status) — this doubles as the diagnosis report, not just the gate
  output.
- **Exit 0 only if every load at every viewport painted. Exit 1 with the
  table on any miss.** This is now a real gate, not a report-only script —
  the escalation to "likely real" means a miss blocks the gate exactly like
  any other assertion.
