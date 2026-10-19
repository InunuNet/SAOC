# launch-weekend F7 - launch accessibility and form quality (golden spec)

Evidence: .tmp/sandbox/leeann-demo/E2E-REPORT.md (run 2: J4, J8 fail), .tmp/sandbox/excellence-audit/tech/REPORT.md
(P0-3, P1-3, P1-4), backlog "Launch F7" and R32/R42 lines. Node-level axe measured on beta 2026-10-16 with
contracts/checks/launch-weekend/f7/probe-axe-nodes.mjs (run it for the exact selectors; it is the dev's work list).

Split: **F7a** (SAOC routes + global + hero + ticket form + chrome) and **F7b** (vendor apply form). Disjoint
files, run as two parallel dev passes. The gate is the union. Read first (both): .claude/skills/impeccable
(SKILL.md, reference/craft-floor.md, reference/audit.md), .claude/skills/accessibility, docs/rules/no-invention.md.
Build on top of F1 (it edits Hero.tsx, Footer.tsx, Header.tsx, globals.css too): set BASE_REF to the commit with F1 merged.

## 1. Contrast (WCAG 1.4.3) - existing tokens only, token VALUES untouched

Ratios computed from the :root values (parchment #f4f3ec, p800 #22281f, primary #384138, accent #9e8c6b, soft #c2b393).

| Failing today | Ratio | Replace with (existing token) | Ratio |
|---|---|---|---|
| `bg-accent` + `text-ivory` (CTASection, ShowBand, UtilityBar-style pills, all forms, not-found, tickets cancelled) | 2.94 | `bg-accent` + `text-ink` - this IS the handoff `.btn--accent` (styles.css:207) | 5.40 |
| `bg-accent` + `text-primary` (UtilityBar:63) | 3.24 | `text-ink` | 5.40 |
| hover `bg-accent-soft` | - | with `text-ink` | 8.56 |
| Footer `text-ivory/45`, ShowBand `dt` `text-ivory/50` on p800 | 3.92 / 4.48 | `text-ivory/65` = handoff `--fg-on-dark-muted` (colors_and_type.css:36) | 6.59 |
| `text-ink/60` on paper (ShowSectionNav hint, AwardsGrid, EventRow, sponsors, media-kit) | 4.48 | `text-ink/70` (or `text-muted` 5.24) | 6.24 |
| `text-accent` (brass) text on paper: home EventsStrip link, tickets cards, events chip | 2.94 / 2.61 | `text-primary` for links, `text-muted` for labels | 9+ / 5.24 |

Footer hover states: keep one step brighter than base (e.g. base /65, hover full ivory). Do not touch hover-only tokens that already pass.

## 2. Moderate axe issues
- `region`: UtilityBar renders a bare `<div>` above `<header>`, outside every landmark (node `.bg-primary-800.text-ivory:nth-child(3)`). Give it a landmark role with an accessible name or move it inside the banner landmark. No visual change.
- `heading-order` (/societies, /judging, /media-kit): card titles are `h3` directly after the page `h1`. Make them `h2` (keep the visual class) or add a real `h2` section heading.

## 3. R42 hero carousel (components/home/Hero.tsx)
- Visible Pause/Play button inside the hero, before the dots in DOM order, >=44x44 hit area (never under 24), name switches Pause <-> Play. Autoplay stays the default (handoff README:199). Ghost-light styling from the handoff (`.btn--ghost-light`, styles.css:231), no new colours.
- `prefers-reduced-motion: reduce`: the interval never starts (read with matchMedia; follow changes). Dots remain for manual advance.
- Fade only (README:145): slide wrappers transition `opacity` only. No transform, no slide.
- Semantics: wrapper `aria-roledescription="carousel"` with an accessible name; each slide `role="group" aria-roledescription="slide" aria-label="N of M[: subject]"`; the subject is the slide's alt (static fallback list: Yellow/Violet/Pink/Dark orchid). Sanity heroImages have no alt field: label is just "N of M" (do not invent subjects). Inactive slides `aria-hidden`. Dots named for the slide ("Show slide N: subject"), not "Image N"; if kept as role=tab each needs aria-controls to a tabpanel, otherwise plain buttons with `aria-current`.
- Lede (`p`, 20px): full-opacity `text-ivory` (the handoff `--fg-on-dark`), not `/75`. "100% white" = the ivory token, no literal #fff.
- Scrim: existing gradient classes, every stop >= 55% (`from-primary/60 via-primary/60 to-primary/85` is the minimum change). Precedent: handoff `.hero__scrim` (styles.css:557) .58/.42/.78, `.pagehero__scrim` (646) .55 -> .80, `.show-hero__scrim` (1625) .72 -> .84. The gate measures the 95th-percentile pixel behind the lede on every slide (needs >= 4.5:1 vs ivory); raise stops within the handoff's .55-.84 range until it passes.
- Replace the literal "→" glyphs with an inline SVG (lucide ArrowRight is already a dependency), aria-hidden. Eyebrows stay (README:52,64,101).

## 4. Global items
- **Ticket form** (components/tickets/TicketPurchaseForm.tsx, tickets/[slug]/page.tsx): submit `disabled` while the cart is empty (keep `cartError`); "Estimated total" paragraph in an `aria-live="polite"` region; `generateMetadata` on tickets/[slug] titled from the ticket type name. TEST MODE banner: do NOT remove or restyle. Verified gating (fail-closed): `OzowSandboxTestModeBanner` returns null unless `/api/tickets/ozow-sandbox-test-mode` returns `{enabled:true}`, which reads the admin-written Firestore flag and fails closed. The checks keep that contract. The untracked national-show/tickets/buy/* pages (F3) reuse these components; their own page `metadata` is F3's.
- **Mobile menu** (Header.tsx, MobileMenu.tsx): hamburger gets `aria-expanded` + `aria-controls` (it has neither today); recheck duplicates on current main: the opened menu must not repeat a link, nor have two different links with one name.
- **Sticky header** (74px desktop / 62px mobile): `html { scroll-padding-top }` >= header height (WCAG 2.4.11). Layout value, not a colour; in globals.css outside :root/@theme.
- **Targets 2.5.8**: back links (societies/[slug], events/[slug]), media-kit "Download", VenueCard "Open in a map", exhibitors back link: >= 24x24 (padding, not font size). Archive back links are F6's.
- **Alt**: hero/photo `<img>` decorative -> `alt=""`, meaningful -> real text; no file-name alts. PhotoBand must not default alt to "". NOS hero alts (repeated pair) are NOS Site's.

## 5. F7b - vendor apply form (R32 / J4)
Client validation before POST (new lib/vendor-apply-form-validation.ts mirrors validateVendorApplicationInput's rules and error vocabulary, strict integer for stands - never parseInt to decide validity, see lib/vendor-register-form-validation.ts); an invalid submit never POSTs. Inline error under each invalid field linked by `aria-describedby`, `aria-invalid="true"`; a summary `role="alert"` in a `tabIndex={-1}` wrapper that is focused after an invalid submit, each item linking to `#vendor-register-<key>`; all values kept; "(required)"/"(optional)" in label and legend text (opt-in prop so VendorRegisterForm's labels do not change); the sentence in goldens/f7/vendor-apply-copy.json verbatim, once; `autocomplete` organization/name/email/tel; stands `type=number inputMode=numeric min=1`; input and checkbox borders >= 3:1 (WCAG 1.4.11) with an existing token (`border-muted` 5.24, primary-700, ink) - not `border-rule`; remove `aria-required` from the category `<fieldset>` (axe aria-allowed-attr, critical); submit button `text-ink` on brass and >= 48px. Inline error copy: reuse humaniseFieldError() strings; no new sentences. Server validation, the route and the payload shape are untouched.

## 6. Out of scope / parked
NOS hub page.tsx and tickets (F3), archive and shows data (F6), nos-theme margins, NosSkipLink, ShowContentState (F2-r36), presenters.css, NOS hero alts, NOS `<dl>` and FAQ h1 findings. Brass-on-paper text that axe does not flag today (MegaMenu open state `text-accent` eyebrows, not-found.tsx:21, ShowFaqList:60) is listed as a design question, not edited.

## DESIGN QUESTIONS for Brad
1. Brass text on paper cannot pass AA (2.94:1) with any opacity of an existing token, and the handoff names brass "eyebrow text" (README:47). We swap the axe-flagged nodes to `--primary`/`--muted`. Brass eyebrows axe does not yet reach (MegaMenu, not-found, ShowFaqList) stay until you rule: recolour them the same way (recommended) or accept the miss.
2. Hero slide subjects: Sanity heroImages have no alt field, so only the 4 static fallbacks get named subjects. Naming the live slides needs an `alt` field on the schema and text from Lee-Ann.
3. Hero scrim goes from .50/.60/.85 to >= .55 everywhere (handoff pagehero precedent), so the photos read slightly darker; the pause button has no handoff component, so it reuses the ghost-light button.
(FYI, not a question: handoff `.btn--accent` is ink-on-brass, so the fix restores the handoff rather than inventing a colour.)

## 7. F7c - R45 to R48 (third dev pass; existing strings only, data untouched)
- **/societies (R45):** polite live region with the result count (existing no-results copy at SocietiesClient.tsx:90-92 stays); search input gets a visible `<label>` reusing the placeholder string "Search by name or region…" and a border >= 3:1 with the same token as R32 (`border-muted`); "est. 1976" renders "Founded 1976" in SocietyCard.tsx:65 and SocietyFacts.tsx:20 (display only); province chips show the full name (their aria-label) at >= 481px, abbreviations at <= 480px (CSS visibility, accessible name unchanged). Member count and founding data are not touched.
- **/judging (R46):** "Overview", "How judging works", "SAOC awards" become real h2s with the eyebrow styling kept; AwardsGrid cards keep h3 under an h2; awards rendered in points order FCC, AM, HCC then CCM, CBR, JC under an "Other awards" group label (display grouping by code, no data change); award ladder as a captioned table or dl from existing strings (P2); prose blocks at the body role, >= 15px (P2). The stats (judging/page.tsx:37-44) are untouched.
- **Footer newsletter (R47):** visible label reusing the placeholder string "your@email.co.za", `autocomplete="email"`.
- **/members (R48):** `autocomplete="name"` and `autocomplete="email"` on the suggestion form.

Gaps noticed, not assigned: the footer newsletter `<form>` only calls `preventDefault` (submitting does nothing and nothing is stored); its input border (`ivory/20` on p800) is about 1.5:1 (1.4.11); the label-in-name finding on the footer lockup (audit P1-7); `/national-show/faq` has no h1 (NOS Site).

## 8. Rulings (architect, after the F7a/F7b dev pass)
- **NOS accent buttons:** inside `.nos-theme` the accent is violet #7e3f97, so ink on it is 2.25:1. Accepted: the single scoped override `.nos-theme .bg-accent.text-ink { color: var(--ivory) }` (token, ivory on violet about 6.8:1) keeps the show buttons as they were. A1 now asserts it exists and is token-based; SAOC scope keeps ink-on-brass.
- **Vendor checkbox:** no checkbox exists in the handoff (design/design_handoff_saoc/src, ui_kits and both READMEs searched), so the custom 20px appearance-none box has NO handoff basis and is a visual change. A native checkbox is a user-agent control exempt from 1.4.11 and computes border-width 0, so the original gate demand (border >= 3:1 via border-muted) was a check defect, not a design need. Ruling: revert to the native checkbox (keep the >= 24px label hit area; `accent-color: var(--primary)` is an acceptable token-only touch). A9 now exempts native checkboxes and still holds an appearance-none box to 3:1. If Brad wants the custom box he must say so; it is his call, not a handoff requirement.
- **Hero scrim 0.75:** inside the cited handoff range (.pagehero .55-.80, .show-hero .72-.84); accepted.
