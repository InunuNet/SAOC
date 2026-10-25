# polish-wave-2-2026-10-25 — shared decisions

Mission: second overnight polish wave on both sites, from the ranked BUILDABLE list
(.tmp/sandbox/audit/backlog-triage-2026-10-25.md) and the open rows of .agent/memory/project/backlog.md (~L2900-2910).
Base: origin/main ee2e9941. Wave 1 (PR #92, branch fix/polish-wave-2026-10-25) and the audit fixes (PR #93, fix/audit-2026-10-25) are
OPEN, not merged. Contracts: contract-f2, f3, f4, f6, f7, f8 (feature ids kept from the dispatch brief; F1 and F5 were dropped as stale, so there are no
contract-f1 or contract-f5 files).

## Governing rules (cite in every dev brief)
- No invention: docs/rules/no-invention.md. This wave adds NO new copy. F2 removes a stat, F4 reuses two existing page titles as link labels,
  F7 reuses the existing sentence, F8 reuses existing labels (labels.json wording) and gives its radio-group legends only as visually hidden
  existing section headings.
- Visuals only from design/design_handoff_saoc/ and branding/ (read-only). Every class and token named in a golden already exists in the repo.
- UI checks run at 390@3, 768@1, 1280@1 and 1440@2 (contracts/checks/polish-wave-2-2026-10-25/_viewports.mjs).
- Dev briefs name the design skills: impeccable, web-design-guidelines, accessibility.

## Candidates dropped (verified against origin/main ee2e9941, evidence)
- F1 home YearbookStrip editor/ISSN/page count (backlog L2888): ALREADY DONE. components/home/YearbookStrip.tsx has no editor, ISSN or page
  count; its header comment reads "The page count, ISSN and editor are removed (24 Oct 2026)" (Lee-Ann content build, PR #90).
- F5 /members SuggestionForm per-field errors (backlog L2715): ALREADY DONE. components/members/SuggestionForm.tsx has a FieldErrors map, per-field
  aria-invalid and aria-describedby, a TicketFieldAlert per field (ids msf-name-error, msf-email-error, msf-message-error), and focuses the first invalid
  field on submit. Only the hydration guard is missing, and that is wave 1 F1 (PR #92).
- F3 sub-items dropped (the rest of F3 is kept): (1) "aria-live=polite on the total" is ALREADY DONE (TicketPurchaseForm.tsx, the Total paragraph carries
  aria-live="polite" aria-atomic="true"). (2) "Buy disabled at qty 0" CONTRADICTS a documented design decision (see DESIGN QUESTION below).

## NOS Design rulings (final, 2026-10-25): goldens/nos-design-rulings-2026-10-25.md
They answer design questions 2, 3 and 4 below and agree with 1 (Buy stays enabled at qty 0). F4 labels are "Refunds" and "Privacy" as "Refunds · Privacy"; F3 is left on the hero axis, full width below 1024; F8 text-only pickers with the added a11y conditions. The questions below are kept as the record of what was asked.

## Round 2 flag: new copy in the Lockups picker
The ruling's heading "Lockups" and the four variant labels are not existing strings (existing lockup_label: "Horizontal — dark type on light", "Horizontal — light type on dark", "Vertical — dark type on light", "Vertical — light type on dark"). Built as ruled because the lead and NOS Design specified them; if the no-invention rule is applied strictly, swap to the existing labels (one constant; the heading has no existing equivalent).

## DESIGN QUESTIONS (flagged, not resolved by invention)
1. Buy button at quantity 0. TicketPurchaseForm.tsx's own comment: "The CTA stays enabled at quantity 0; a click there fills the hint and moves focus to it",
   and the same for no day chosen (r45b). The backlog asks for the opposite. A disabled submit leaves the keyboard tab order, hides the reason, and a disabled
   button has no accessible explanation. Not built; Brad / NOS Design to rule. If they choose "disabled", it is a one-line change plus the hint staying
   visible: say so and a contract follows.
2. F4 label wording. Two existing strings exist for each policy page. Chosen: the pages' own H1 titles ("Refund & Cancellation Policy", "Privacy and
   Personal Information Policy" - content/legal/privacy.ts) so a visitor clicking sees the same words. The alternative is the NOS footer's short labels
   ("Refunds", "Privacy", components/nos-chrome/nos-footer-data.ts). The privacy H1 is long and wraps at 390. Either is existing copy; swap is a two-string change.
3. F3 form column alignment. Moving the 560px form onto the NOS container axis means the column is left-aligned under the hero (as every other NOS
   section is), not centred. This follows the backlog row ("One left axis - use the shared container axis") and R71 (.agent/memory backlog L2424), so it is built,
   but the visual change at >=1280 is real (column moves from x~385 to the hero's x). Flagged for the browser critique.
4. F8 scope. Only the SAOC /media-kit page is in scope (the backlog row names it). The NOS-host /national-show/media-kit page also lists the 16 NOS logos
   and is left as is. And the new pickers are text-only chips: the 8 NOS colourways have no swatch colours in the data, and inventing hex values is off limits.

## Dependencies and merge order
- PR #92 (wave 1) touches TicketPurchaseForm.tsx (hydration guard: F4 here), SubmitEventForm.tsx (F7 here) and nos-structure.css is NOT touched by it.
  The edits here are in different hunks. Land after #92, or branch from origin/fix/polish-wave-2026-10-25 and run the scope guard with
  POLISH2_BASE=origin/fix/polish-wave-2026-10-25 so wave 1's files do not count as out of scope.
- PR #93 (audit) touches app/(nos)/tickets/[slug]/loading.tsx and societies pages, none of which this wave edits.
- F3 and F4 both edit app/(nos)/national-show/nos-structure.css (different rules) and F3 edits app/(nos)/tickets/[slug]/page.tsx while F4 edits
  TicketPurchaseForm.tsx. One dev should do F3 then F4 in order.
- F6 edits an OLD mission's contract (ticket-onsale-predicate/contract-f1.yaml A7): log it in checks-updated.md.

## Hermetic render
Same as wave 1: build with `NEXT_PUBLIC_SANITY_PROJECT_ID=26yfbug4 NEXT_PUBLIC_SANITY_DATASET=production NEXT_PUBLIC_SAOC_SITE_URL=http://localhost:3002
NEXT_PUBLIC_NOS_SITE_URL=http://nos.localhost:3002 pnpm build`. _server.mjs runs `next start` on a free port in 3030-3049 with BETA_PASSWORD_WALL_OFF=true.
Three features need an env-gated fixture route because the real page cannot be reached hermetically (F4: no on-sale ticket; F8: admin-gated page):
app/ticket-fixtures/buy/page.tsx (TICKET_FIXTURES=1) and app/media-kit-fixtures/page.tsx (MEDIA_KIT_FIXTURES=1). Both are force-dynamic, 404 unless the
flag is '1' at request time, never touch auth, and the flag appears in no deploy or example env file (the static checks enforce it).
F3's rendered check needs a /tickets/<slug> link on the NOS hub from the live dataset; it fails loudly if there is none.

## Checks that could not be proven RED here
The static checks, f6-hub-filter.mts and f6-a7-nonvacuous.py were run on the unchanged tree and are RED (see the architect report). The rendered
checks (f2, f3, f4, f8) need a production build, which was not made (disk). They were syntax-checked (node --check) and are designed to be RED on the
unchanged tree by construction: F2 (a "1968" term exists, third stat at 50%), F3 (crumb links are ~40px, form column x differs from the h1), F4/F8
(fixture route absent -> 404 on the flagged server). @dev must run each once on the unchanged tree before editing to confirm RED, and note the output.

## Never
Edit anything under contracts/checks/polish-wave-2-2026-10-25/ or this spec directory (QA inputs). Edit AGENTS.md. Use pkill. Edit
app/(nos)/tickets/[slug]/loading.tsx, DuotonePicker.tsx, or any file not on a goldens/scope/*.json allow-list.
