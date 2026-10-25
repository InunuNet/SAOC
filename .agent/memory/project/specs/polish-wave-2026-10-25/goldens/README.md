# polish-wave-2026-10-25 — shared decisions

Mission: overnight polish of both sites. Four features, four contracts (contract-f1..f4.yaml). Base: origin/main a0bd16d4
(PR #88, the ticket on-sale predicate, had not merged when this was written; rebase before dispatch if it has).
Source list: .tmp/sandbox/audit/backlog-triage-2026-10-25.md (items 1, 2, 4, 5, 6, 8, 9, 10).

## Governing rules (cite in every dev brief)
- No invention: docs/rules/no-invention.md. Copy comes only from Lee-Ann's Drive docs (content/drive-source/, Drive folder
  "Docs for Brad" 1rZJVrYwrWM92vqmPw2c9E_HABQKEQoGa). This wave adds NO new copy. F4 only removes, and the one reworded
  sentence is built from words already on the page (pinned in goldens/f4-removals.md).
- Visuals only from design/design_handoff_saoc/ (colors_and_type.css, README.md) and branding/. F2 reuses the existing chrome
  focus class (focus-visible:ring-primary, components/chrome/Header.tsx:94, MobileMenu.tsx:105). No new colour, token or class.
- UI checks run at 390@3, 768@1, 1280@1 and 1440@2 (every rendered check here loops those four).
- Dev briefs name the design skills: impeccable, web-design-guidelines, accessibility.

## Items checked and EXCLUDED
- Home YearbookStrip sample editor name, ISSN and page count (backlog L2888): already removed by the leeann-content-build F4
  contract (A1: "the yearbook's 184 pages, ISSN and editor" gone; branch feat/leeann-content-m2 diffs components/home/YearbookStrip.tsx,
  deleting YEARBOOK_META and "184 pages."). Doing it here would collide on the same file.
- F2 "Continue button reaches >=44px" (VendorRegistrationCodeEntryForm.tsx:119): STALE. components/nos/Button.tsx already
  carries min-h-[50px]; measured 133.5 x 50 at 390@3 on the unchanged tree. No assertion (it cannot be red).

## Measured facts that shaped the contracts (unchanged tree, next start of a production build)
- The vendor pages render inside .nos-theme, whose `:focus-visible` rule paints a 2px solid #7e3f97 outline (nos-theme.css:257).
  Keyboard focus on vendor checkboxes already clears 3:1 and label rows are already >=44px (min-h-11 on the group field).
  What is genuinely broken: the controls are 16x16 (all 16 on /vendors/apply), and a pointer click (focus without focus-visible)
  shows the faint ring-ink/40 box-shadow (14 of 16 under 3:1). So F2's focus work is replacing the 12 `ring-ink/40` sites with
  `ring-primary` (dead on keyboard focus, live on pointer focus), not a keyboard-focus fix.
- The public build withholds placeholder prose, so the /sponsors "Become a sponsor" body paragraph is not rendered on public; its
  alignment is checked statically (f4-removals-static.mjs).
- /programme's H2 "Programme" is a TicketSection heading rendered from live Sanity cards. It is reached by the rendered check.

## Pre-existing checks this wave must edit (supersession), each logged in checks-updated.md
- F2: contracts/checks/vendor-form-input-focus-indicators-f1/check-a1-ring-tokens.sh and check-a2-checkbox-radio-regression.sh pin
  `ring-ink/40` and `h-4 w-4` byte-for-byte. Update the expected tokens to the new ones; do not delete the checks.
- F3: contracts/golden/saoc-seo-polish/sitemap-expected.json lists /members under `include`; move it to `exclude` with a reason
  ("The members area has no portal yet; the page says so. Listing it invites a crawl of an empty page.") or the drift guard in
  contracts/checks/saoc-seo-polish/check-sitemap-routes.mts fails. That reason is a repo-internal note, not site copy.
Write .agent/memory/project/specs/polish-wave-2026-10-25/checks-updated.md naming each edited file and why.

## Hermetic render
Rendered checks need a build made with the public Sanity ids (read-only, from .env.local.example) and local origins:
`NEXT_PUBLIC_SANITY_PROJECT_ID=26yfbug4 NEXT_PUBLIC_SANITY_DATASET=production NEXT_PUBLIC_SAOC_SITE_URL=http://localhost:3002 NEXT_PUBLIC_NOS_SITE_URL=http://nos.localhost:3002 pnpm build`.
Without them prerender throws "Sanity client is not configured". The server helper (contracts/checks/polish-wave-2026-10-25/_server.mjs)
runs `next start` on a free port in 3030-3049 with BETA_PASSWORD_WALL_OFF=true; SAOC pages are localhost:<port>, NOS pages nos.localhost:<port>.
The checks read the HTML meta robots tag, never X-Robots-Tag, because the beta wall adds noindex to every response.
Do not run `pnpm build` while another agent's dev server uses this worktree.

## COPY GAP (flag, do not fill)
After F4 the judging fallback still says "available to SAOC members", which implies a members area that does not exist yet.
Lee-Ann must supply what members can actually do. Not fixable by removal. Raise in her Google Doc.

## Never
Edit anything under contracts/checks/polish-wave-2026-10-25/ or this spec directory (QA inputs). Edit AGENTS.md. Use pkill.

## Addendum 2026-10-25 (F5-F8, and corrections)
- F5 event detail, F6 /events/submit, F7 targets and scrollbar gutter, F8 NOS nav consistency were added after the first four. Goldens: f5-event-detail.md,
  f6-submit-event.md, f7-targets.md, f8-nos-nav.md; scope lists goldens/scope/f5..f8.json. Base is origin/main 9b7e233d (PR #88 and the events redesign #89
  are on main, so ShowBand/EV-2 needs no dependency). NOS Site PR #76 lands first: F3's cancelled-page robots edit, F8 and F2 stay clear of its hero edits
  (F2 never touches app/(nos)/national-show/vendors/apply/page.tsx; F8 changes only the national-show layout). LT-1 (serif headings weight 300 on NOS) is
  not asserted anywhere: no check here measures a heading font-weight on a NOS page. F6 measures weight 300 only on the SAOC /contact pattern.
- CORRECTION to F1: /events/submit is behind a Firebase session, so the form the first F1 rendered check found there was the footer newsletter form. The rendered
  check now targets the form inside <main> on /contact, /members, /vendors/apply and /vendors/register (4 forms x 4 viewports x Enter/click = 32 findings on the
  baseline). SubmitEventForm is static-only. Separate finding: components/newsletter/NewsletterSignup.tsx:114 (footer, every page, both hosts) is also a native
  GET before hydration; it is NOT in F1 because feat/nos-newsletter-topics modifies the same file. Fold in after that merges.
- Open decisions raised to the lead: (a) F5 CTA labels ("Book tickets"/"Show details" kept vs the ruling's "Tickets"/"National Show"), (b) F6 submit button token
  (--primary pinned; ContactForm's button is the accent token), (c) NewsletterSignup scope.
- Hermetic notes: the rendered checks take their own server (free port 3030-3049). A machine-wide pkill from another session can kill a baseline run mid-way
  (ECONNREFUSED); re-run, it is not a real red. F8 runs with preview env at runtime only and takes ~90s.

## Addendum 2 (check fixes after QA)
- F2 pointer ring: the first rendered check read the first rgba in box-shadow, which Tailwind v4 makes a transparent offset shadow, so the "14 of 16 under 3:1"
  finding above was false. It now reads the last visible shadow; with that, the pointer-ring sub-check is GREEN on the baseline and is a guard only. F2's rendered red is
  control size (16 of 16 under 24px). The ring-ink/40 removal stays enforced by f2-a11y-static.mjs as consistency cleanup.
- Scope: components/newsletter/NewsletterSignup.tsx is now on the F1 and F2 allow-lists (method post plus useHydrated; size-6 topic checkboxes, enforced in
  f2-a11y-static.mjs); components/ui/PageHero.tsx is on F4's (eyebrow made optional so the /sponsors eyebrow can go).
- f1-forms-nojs.mjs now also covers the footer newsletter form on both hosts (48 baseline findings) and asserts /events/submit renders no form in <main> without a session.
- _server.mjs portFree tests 127.0.0.1, :: and 0.0.0.0 in turn, so another agent's server on *:3030 can no longer shadow the port.

## Follow-ups (out of scope tonight)

- /events/submit LoginPrompt ("Members only", `app/(marketing)/events/submit/page.tsx`) is off-system: text-2xl font-semibold, text-gray-* and a plain underlined link. F6 deliberately leaves it untouched and its static check scans only the authenticated branch, SubmitEventPageBody.tsx and SubmitEventForm.tsx. Its copy ("available to SAOC members") also needs Lee-Ann to say what members can do.
