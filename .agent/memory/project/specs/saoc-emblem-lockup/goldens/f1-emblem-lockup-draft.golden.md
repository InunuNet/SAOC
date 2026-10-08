# Golden — SAOC emblem lockup, DRAFT local preview (F1)

Status: **DRAFT, local preview only.** Brad, 2026-10-08, verbatim: "its a draft
lets see how it looks before we commit." Nothing in this feature is committed
or deployed. The gate for this pass is local: assets + source assertions +
`pnpm build` + Playwright screenshots of `http://localhost:3002`. Deployed-site
proof is a separate, later phase (phase 2 below) that does not run until Brad
approves what he sees locally.

## Source of truth

1. Brad's Claude Design artifact, "SAOC · Lockup explorer"
   (https://claude.ai/artifact/86ZiRAXBRbam43es9JgWSX), extracted to
   `.tmp/sandbox/council-artifact/app.js`. Its `state` defaults ARE Brad's
   recommendation (not one option among several):
   - wordmark `WM:0` → "SA Orchid Council"
   - tagline `T:0` → "Making a difference since 1968", JetBrains Mono weight
     500, uppercase, `0.22em` letter-spacing
   - emblem treatment `E:0` → full colour (the `variant()` function returns the
     raw source image untouched for `E:0`; the duotone recolouring in
     `variant()` only fires for `E:1..3` — full colour is ground-agnostic, the
     SAME image file serves the header's light ground and the footer's dark
     ground)
   - `rule:true, rs:100` → a divider rule, on, at 100% scale
   - `es:140, ns:110, tsz:140` → emblem/wordmark/tagline scale, all expressed
     as **percentages of each lockup's own 100% base**, not absolute units
   - `G:'light'` → light ground (the header's case; footer is the explorer's
     "dark ground" panel, mark-only is a third, separate panel)
2. Brad's scope answer (relayed by team-lead, 2026-10-08): **"Lockup only."**
   Site keeps Sage & Paper (`--primary #384138`, `--parchment #f4f3ec`) and
   Crimson Pro / JetBrains Mono. The explorer's palette `P:2` ("Lapis & Sun")
   and name font `N:7` ("Lora") are **out of scope** — `app/globals.css`'s
   colour and font tokens do not change.
3. Emblem artwork: `branding/SA Orchid Council/emblem/Eulophia-speciosa-emblem.png`
   — RGBA, 1254×1254, transparent ground, confirmed by Brad as the approved
   draft. `branding/` is read-only (Brad's active workstream, per
   `project_design_folders_brad_active` memory and `docs/rules/no-invention.md`).

## What already matches, and what changes

Reading Header.tsx / Footer.tsx / UtilityBar.tsx against the explorer's
defaults: the wordmark text ("SA Orchid Council"), the tagline text/font/case/
tracking, and the light/dark grounds **already match Brad's recommendation
exactly** — none of those are new work. Two things are genuinely new:

1. **The emblem artwork itself** — swap the current flat vector mark
   (`saoc-logo-ink-paper.png` / `saoc-logo-flat-paper.png`) for a trimmed,
   full-colour web export of `Eulophia-speciosa-emblem.png`.
2. **The divider rule** (`rule:true, rs:100`) — a vertical hairline between
   the emblem and the wordmark/tagline text block. No such element exists in
   the current Header/Footer/MobileMenu markup today; this is new.
3. **Size** — `es:140 / ns:110 / tsz:140` scale the emblem/wordmark/tagline up
   from whatever each lockup's own "100%" is.

## Derivation method (named, not invented)

`metrics()`'s own numbers (`88 * es`, `46 * ns`, `11.5 * ts`, …) are the
explorer's **own export-canvas base units** — they size a PNG/SVG the
explorer itself renders for download, at a reference scale that has no fixed
relationship to this site's existing header/footer CSS pixel sizes (the site's
header emblem is 48px tall today; the explorer's own 100% base for the same
element is 88 units). Applying the explorer's raw unit numbers to the site's
CSS would silently invent a new, disconnected size. The only correspondence
`metrics()` actually gives us is proportional: **`es`/`ns`/`tsz` are percentage
multipliers of each lockup's own current base size.**

**Chosen translation (named explicitly, this is the one interpretive step in
this golden — not a fact, a modelling decision for @dev to implement and for
Brad to see and react to in the draft):** apply `es/ns/tsz` as percentage
multipliers to each component's own *existing, already-committed* base pixel
sizes, rounding to the nearest integer px.

| spot | element | current base | × scale | → target |
|---|---|---|---|---|
| Header (`components/chrome/Header.tsx:92`) | emblem | 48px | ×1.40 (es) | **67px** |
| Header | wordmark | 22px (`text-[22px]`) | ×1.10 (ns) | **24px** |
| Header | tagline | 10.5px (`text-[10.5px]`) | ×1.40 (tsz) | **15px** |
| Footer (`components/chrome/Footer.tsx:33`) | emblem | 64px | ×1.40 (es) | **90px** |
| Footer | wordmark | 22px | ×1.10 (ns) | **24px** |
| Footer | tagline | 10px (`text-[10px]`) | ×1.40 (tsz) | **14px** |
| MobileMenu (`components/chrome/MobileMenu.tsx:108`) | emblem | 36px | ×1.40 (es) | **50px** |
| MobileMenu | wordmark | 16px (`text-[16px]`) | ×1.10 (ns) | **18px** |

MobileMenu carries no tagline today — none is added; `ns`/`es` scaling is the
same lockup treatment as Header/Mobile already share (mark + wordmark, no
tagline), not the explorer's separate "mark only 56/24/12" panel (that panel
is a demonstration of 3 generic icon-use sizes, e.g. favicon-class uses — the
parallel favicon work is a different, already-excluded @dev task, see Scope).

### Divider rule

- Colour, light ground (Header): `metrics()`'s light-ground rule colour is
  `PALETTES[P:2].accent` — but palette is out of scope, so read it against
  the SITE's own Sage & Paper palette instead, where `--accent: #9e8c6b` is
  the *exact same hex* the explorer's own default "Sage & Paper" palette
  (`P:0` in `PALETTES`, id `P1`) uses for `accent`. No new colour: `var(--accent)`.
- Colour, dark ground (Footer): the explorer hardcodes
  `rule:'rgba(255,255,255,0.35)'` for every dark-ground case regardless of
  palette — use that value verbatim (close enough to the site's `--ivory` that
  reading it as `rgba(255,255,255,0.35)` directly, not re-derived through the
  ivory token, avoids inventing a different opacity).
- Width: 1px (the explorer's own `x.fillRect(..., k, rh)` / `k` is a single
  device-pixel-scaled unit — i.e. a 1px hairline at CSS scale).
- Height: **named gap.** `metrics()`'s `ruleH` formula (≈85 export-canvas
  units at these defaults) has the same base-unit mismatch as emblem/wordmark/
  tagline above, and unlike those three there's no already-existing site rule
  divider to express it as a ratio against. The ordinary, non-invented
  resolution: let the rule stretch to the height of the text block it sits
  beside (CSS `align-items: stretch` / `h-full` on the flex row), which is
  what a divider rule conventionally does and needs no invented number.

## Scope boundaries (do not touch)

- `app/globals.css` colour/font `@theme` tokens — byte-unchanged (pinned
  base below).
- `branding/` — read-only source, never written.
- `app/(marketing)/media-kit/page.tsx` — lists the OLD logo files as
  downloadable press assets; that's a separate press-resources concern, not
  one of the explorer's three lockup panels (header / footer / mark-only).
  Byte-unchanged in this feature.
- `/national-show` NOS chrome — owned by `saoc-nos-design-f1`, untouched here.
- `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png` — a separate @dev is
  replacing these from the same draft emblem; excluded from this feature's
  diff.
- Existing `saoc-logo-*.png` files under `public/images/` — kept in place,
  byte-unchanged (checksums pinned in
  `goldens/fixtures/pre-existing-logo-checksums.txt`), so this draft is
  trivially revertible: delete the two new asset files and the three chrome
  diffs, and the site is back to its current state exactly.

**Pinned base commit** for all "unchanged" diffs in this contract:
`67d35581` (`git rev-parse HEAD` at the time this contract was written,
2026-10-08, on `feat/conference-workshop-tickets`) — never the literal
string `HEAD`, for the same reason `conference-workshop-tickets-f6`'s A9/A10
fix exists: once this feature's own commit lands, working tree == HEAD and a
`HEAD`-literal diff goes silently empty.

## 320px responsive behaviour

Header already hides the wordmark/tagline text span below the `sm` breakpoint
(`hidden sm:flex`, `components/chrome/Header.tsx:93`) — at 320px the header
already collapses to mark-only today, by an existing mechanism this feature
does not change. This happens to be exactly the explorer's "mark only" concept,
just arrived at by a pre-existing Tailwind utility rather than new code. The
mark itself keeps its scaled 67px size at every width (no separate mobile-only
size is introduced) — the collapse is which elements render, not a size change
of the mark. Footer's lockup is centred in a `grid-cols-1` column on narrow
viewports and keeps rendering mark + wordmark + tagline stacked (Footer has no
existing hide-on-mobile rule for its text block, and this feature does not add
one — only the asset/size change applies there too).

## Known gaps (named, not filled)

- The divider-rule height resolution above (stretch-to-text-block-height) is
  the sound default, not a number pulled from `metrics()` — flagged so Brad's
  look at the draft can override it if the stretched rule reads wrong.
- The es/ns/tsz-as-percent-of-existing-base translation (the whole "Derivation
  method" section) is the one interpretive bridge in this golden. If Brad's
  eye says the result reads too large/small against the explorer's own
  preview, that's feedback on this translation, not a bug in it.

## Addendum 1 — Brad's four scope corrections, 2026-10-08 (relayed by the NOS design peer / team-lead)

All four arrived after the initial contract was written and are folded in as
new assertions (A13–A18) rather than a rewrite of A1–A12, which still stand.

### 1. Remove the UtilityBar's centred tagline

Verbatim: "remove Making a difference since 1968 from the header its already
in the logo, small changes." `components/chrome/UtilityBar.tsx:54-56`'s
centred `<span>` goes. The email (left, `:32-51`) and the two right-side
pills (National Show pill + "Join a society", `:59-72`) are unchanged — A13
checks the layout mechanism (`justify-between`) survives, not just that the
tagline string disappeared. The tagline still exists on the site — it now
lives only under the wordmark in the Header/Footer lockups themselves (it was
never removed from Header.tsx or Footer.tsx, only from UtilityBar.tsx).

### 2. Header email → info@saoc.co.za

Brad's final ruling, verbatim: "info@saoc.co.za header email." Team-lead's
interpretation, which this golden adopts: the header is info@ everywhere the
header shows it, and the mobile menu is the header on phones, so it's in
scope. In scope: `components/chrome/UtilityBar.tsx` (mailto href + visible
text) and `components/chrome/MobileMenu.tsx` (same, its own footer-meta
block). Out of scope, explicitly, pending Brad's own answer:
`components/societies/SocietyDetailsCallout.tsx` — a society page's own
council-contact prose, not part of the header chrome. A15 pins it
byte-unchanged so this can't drift without a deliberate contract edit.

### 3. Footer becomes the STACKED Lapis-monotone lockup

Brad, with a reference image (`.tmp/sandbox/emblem-lockup/brad-footer-reference.png`,
read directly): "use this lockup variation for the footer sized correctly."
The reference shows, top to bottom, on a dark ground: the emblem in a
blue/white duotone, the wordmark "SA Orchid Council," a horizontal rule, then
"MAKING A DIFFERENCE SINCE 1968" in gold JetBrains Mono.

**This supersedes A7's original horizontal/full-colour footer spec.** The
header is unaffected — stays E1 full-colour, horizontal, exactly as
originally briefed (A18 guards against the two assets getting swapped by
mistake).

- **Emblem treatment:** `TREAT[3]` in app.js, id `E4` "Lapis monotone" — NOT
  the header's `E1` "Full colour." Reproduced via `variant()`'s `e===3`
  branch (`.tmp/sandbox/council-artifact/app.js:68-86`): the `LAPIS` constant
  (`app.js:3`, `#1f3a93`) is the shadow colour, `#eef1fa` (app.js:77) is the
  highlight colour, both chosen by the `else` branch of the `lo`/`hi`
  ternaries at `app.js:76-77` (which only ever fires for `e===3` in practice,
  since `e===0` returns early at line 69). Per-pixel: luminance
  `l = (0.3·R + 0.59·G + 0.11·B)/255` (app.js:80), contrast-stretched to
  `l' = clamp(1.35·l − 0.2, 0, 1)` (app.js:81), then each channel becomes
  `lo + (hi − lo)·l'` (app.js:82), alpha untouched, fully-transparent pixels
  skipped entirely (app.js:79). **A16 checks this is reproduced exactly** —
  at the source level (the generator script must contain the real constants:
  `#1f3a93`, `#eef1fa`, `0.3/0.59/0.11`, `1.35`), not a post-resize pixel
  comparison. Reasoning: a pixel-for-pixel check against the FINAL (trimmed,
  resized) asset would depend on which resize algorithm the generator uses
  (Lanczos vs. bilinear vs. box) — a correct, formula-faithful
  implementation could still fail a byte-exact post-resize comparison for
  reasons that have nothing to do with the duotone math. Checking the
  formula's own constants are present in the generator's source is the
  robust proxy for "not hand-tuned" the instruction actually asked for.
- **Layout:** stacked, not horizontal — emblem centred, then wordmark, then a
  (new) horizontal divider rule, then tagline, in that DOM order. Same
  es/ns/tsz percentages as the header (140%/110%/140%), same translation
  method (Addendum-free, this was already the main golden's method) applied
  to the FOOTER's own pre-existing base sizes: emblem 64→**90px**, wordmark
  22→**24px**, tagline 10→**14px**. The arrangement changes; the Brad-approved
  scale multipliers don't.
- **Colour — ground:** Brad's EARLIER scope answer was "keep the current
  Sage & Paper colours." The reference image's ground is the explorer's
  separate "Lapis & Sun" palette dark (`#172a5c`), which is the out-of-scope
  palette. Resolution: **keep the footer's current dark sage
  (`bg-primary-800`)**; only the emblem treatment becomes Lapis-monotone, not
  the ground. A17 forbids the literal `#172a5c` appearing in Footer.tsx.
  **OPEN QUESTION FOR BRAD** (named, not resolved): does he want the
  reference's navy ground specifically, or is dark sage with a Lapis emblem
  the right reading of "use this lockup variation... sized correctly"? Flag
  this when he reviews the local draft — don't guess past it.
- **Colour — text/rule:** the explorer's own Sage & Paper palette (`P1` in
  `PALETTES`, same id/hex the main golden already matched against the site's
  tokens) gives `onDark: '#f4f3ec'` (= site `--ivory`, already used for the
  wordmark — no change there) and `onDarkMuted: '#c2b393'` (= site
  `--accent-soft`, exact hex match) for the tagline and rule. A17 requires
  `accent-soft` to replace the old `ivory/65` opacity styling on the tagline.
- **"Sized correctly":** interpreted as (a) the derived 90/24/14px sizes
  above, and (b) no horizontal overflow at 320px — A10's capture script now
  also shoots `footer-320.png` and fails the gate if the footer's
  `scrollWidth` exceeds the 320px viewport.

## Triad coverage note

- `codex_qa` and `browser_deployed_check`: declared in **phase 2**
  (post-approval) below — not run in this draft pass, per team-lead's
  instruction that the draft gate must go green without a deploy.
- `gws_inbox_check`: **not applicable.** This feature touches no email path —
  no confirmation send, no admin notification, nothing under `lib/email.ts`
  or the vendor-notification tree. Stated explicitly rather than silently
  omitted, per the triad-coverage convention this project otherwise follows.
