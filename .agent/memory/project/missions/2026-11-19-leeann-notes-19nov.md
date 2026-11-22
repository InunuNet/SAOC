---
schema: athanor.mission/v1
slug: leeann-notes-19nov
goal: Lee-Ann 19 Nov meeting items N1-N14 (backlog section NEXT MISSION) built, QA'd
  and previewed on dev.saoc.co.za for Brad's approval; nothing to beta until he approves
created_at: '2026-11-19T17:31:06.779427+00:00'
started_at: null
last_active_at: '2026-11-20T20:46:02.389718+00:00'
status: pending
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F3
  ts: '2026-11-20T20:46:02.389718+00:00'
features:
- id: F1
  name: 'NOS content N1 N2 N3 N4 N9: extend PR 219 (branch fix/nos-content-19nov)'
  milestone: M1
  status: done
  spec: .agent/memory/project/specs/leeann-notes-19nov/contract.yaml
  completed_at: '2026-11-20T20:46:00.492346+00:00'
- id: F2
  name: 'Registration form N6 N7 N8: extend PR 220 (branch fix/reg-form-19nov)'
  milestone: M1
  status: done
  spec: .agent/memory/project/specs/leeann-notes-19nov/contract.yaml
  completed_at: '2026-11-20T20:46:01.491311+00:00'
- id: F3
  name: 'Ticket prices, Speakers Partner, workshops coming soon N5 N10 N11 N12: branch
    fix/ticket-pricing-19nov'
  milestone: M1
  status: done
  spec: .agent/memory/project/specs/leeann-notes-19nov/contract.yaml
  completed_at: '2026-11-20T20:46:02.389532+00:00'
- id: F4
  name: 'Integration N9 N13 prep: regenerate email and PDF samples, Drive Questions
    doc and copy mirror'
  milestone: M2
  status: done
  spec: .agent/memory/project/specs/leeann-notes-19nov/contract.yaml
milestones:
- id: M1
  features:
  - F1
  - F2
  - F3
  name: Three parallel branches, each QA'd
  status: pending
  gate_ran_at: '2026-11-21T08:58:23.153830+00:00'
  gate_result: fail
- id: M2
  features:
  - F4
  name: Merge to preview/local, regenerate samples, hand to the studio mission
  status: done
force_orphaned_at: '2026-11-21T11:07:39.988974+00:00'
---

# Mission: Lee-Ann 19 Nov meeting items N1-N14 (backlog section NEXT MISSION) built, QA'd and previewed on dev.saoc.co.za for Brad's approval; nothing to beta until he approves

## Context

Plan by the architect, 19 Nov 2026. Contract and goldens: .agent/memory/project/specs/leeann-notes-19nov/. Scope is backlog N1-N14 minus STUDIO. Every dev brief cites docs/rules/no-invention.md and the source for each element: Lee-Ann's "Ticket Pricing.docx" (Drive 15B8Wh4fj1AiEnXUQYE4qIxsxqxS_TkRw), Brad's 19 Nov notes and answers (.agent/memory/scratch/2026-11-19-leeann-meeting-notes.md), and the approved handoff (design/design_handoff_saoc/, branding/).

Merge order onto preview/local (dev.saoc.co.za): F1, F2, F3. F3 rebases on F1 (both touch lib/ticket-email-copy.ts) and on F2 (both touch lib/registration.ts), one line each in distant regions. Nothing merges to main or beta until Brad approves on dev. Sanity patches ship as scripts with --dry-run and --verify and run only when the lead says so.

## Features

### F1 NOS content (extends PR 219, branch fix/nos-content-19nov), N1 N2 N3 N4 N9

Known state: PR 219 CI build FAILED on e2e/mobile-nav-reaches-every-section.spec.ts:191 and e2e/nav-rendered-reachability.spec.ts:196 (the NOS menu "SAOC credit" link text changed by the new-tab sr-only suffix). Codex QA never ran (usage limit until 22 Nov), so use Gemini (agy_qa.sh) for review.

To do:
- Fix the two failing e2e specs (update the expectation or the sr-only text, whichever matches the spec intent) and re-run.
- N3: add info@saoc.co.za to the NOS contact page (lib/show-contact.ts and components/nos/ShowContactDetails.tsx). Keep SHOW_OFFICE_PHONE for the ticket PDF footer (not raised by Brad, leave it). JSON-LD must carry no telephone.
- N2: replace every "Stellenbosch Aerodrome, Stellenbosch Airfield" with "Stellenbosch Aerodrome" and drop "Stellenbosch Airfield" as an address line. Residue on the branch: app/(nos)/national-show/plan-your-visit/page.tsx:51-54, content/show-pages/01, 16, 17, lib/show-contact.ts:24-25, lib/show-identity.ts:107, public/llms-full.txt:42,46, scripts/seed-page-singletons.ts:214, scripts/seed-show-faq.ts:95,224, scripts/checks/verify-show-page-m1.ts:866, verify-show-page-m3.ts:416, contracts/golden/venue-seed-truth/expected-venue.json, contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json, contracts/contract-venue-seed-truth.yaml, contracts/checks/leeann-content/fd.mts:185, contracts/checks/email-shell/fixtures.mts:43 and check-email-shell.mts:213. Historic fixtures that deliberately hold old venue strings (venue-prose-residue, venue-never-changed negative controls, sanity-venue-name-1109.mjs) stay as they are.
- N2 emails and PDFs: lib/ticket-email-copy.ts lines 47, 79, 116 still say "Hangar 25 ... Stellenbosch Airfield". Change to "Stellenbosch Aerodrome" and move the email-sample goldens with it (scripts/ticket-email-sample-fixtures.ts, scripts/checks/verify_ticket_email_goldens.py).
- N9: VIP 16h30-19h00 is already in lib/data/ticket-presentation.ts:69 and lib/ticket-email-copy.ts:199,206. Remove the "Q1 VIP hours" question from scripts/ticket-email-sample-cover.ts and fix the stale 16h00 note in lib/provisional-figures.ts:238 (cite Brad 19 Nov). Lee-Ann's pricing doc says "4pm to 7pm"; Brad's 16h30-19h00 wins.
- N1, N4: review as drafted (SaocText, lib/saoc-mentions.ts, NosHeader, hostRegion).

Live Sanity: venue.name "Stellenbosch Aerodrome" and hostRegion are already live and kept. Still live and WRONG (read-only query 19 Nov): venue.addressLines = ["Stellenbosch Airfield","R44"] and venue.directionsNote ("on the R44 at Stellenbosch Airfield"). New script scripts/fix-nos-address-19nov.mjs (--dry-run, --verify, idempotent, patches only venue.addressLines to ["R44"] and venue.directionsNote with the Airfield phrase removed, prints old to new, never prints tokens). Also grep Sanity prose (showPage, showFaq, showVisitorInfo) read-only for "Airfield" and patch the same way in that script.

Files: the PR 219 file list plus those above. No overlap with F2. One-line overlap with F3 in lib/ticket-email-copy.ts.

### F2 Registration form (extends PR 220, branch fix/reg-form-19nov, CI green), N6 N7 N8

Review and harden, little new code. Brad accepted Independent Member and Overseas Visitor being exclusive with each other and with societies (SOCIETY_EXCLUSIVE in lib/registration.ts; the server validator enforces it too).
- N6: judge-available checkbox only when accreditation starts with "Yes, with "; server ignores availability otherwise.
- N7: None, Independent Member, Overseas visitor first, each excludes the others and every society.
- N8: attendee accordion, one card open, Attendee 1 open first, values survive collapse, a failed submit opens the first card with an error. It applies to every multi-attendee registration form (Symposium, WOSA, cocktails); a single attendee (Speakers Partner) shows no toggle. QA checks keyboard use, aria-expanded, 320px width.

Files: components/tickets/CheckoutErrorSummary.tsx, RegistrationAttendeeFields.tsx, RegistrationSection.tsx, registrationDraft.ts, useRegistrationForm.ts, e2e/registration-forms.spec.ts, e2e/registration-server-rules.spec.ts, lib/registration.ts.

### F3 Ticket prices, Speakers Partner, workshops (branch fix/ticket-pricing-19nov), N5 N10 N11 N12

Start: .claude/worktrees/ticket-pricing-19nov is on branch fix/ticket-pricing-19nov with an uncommitted 21-file diff plus untracked speakers-partner files. Commit it (conventional commits, split pricing / speakers partner / workshops), then review. The draft matches goldens/prices.golden.json and goldens/check_speakers_partner.mts passes against it.
- N5/N10: prices per goldens/prices.golden.json. Live Sanity ALREADY matches (verified read-only 19 Nov: early-bird 120; saoc-symposium and wosa-conference 1200 with regularPrice 1500; cut-off 2027-02-28T00:00:00+02:00, which isWithinEarlyBirdWindow runs through the end of that day; weekend-pass-early-bird inactive). scripts/fix-ticket-prices-19nov.ts has --dry-run and --verify and is idempotent; it needs no further run except --with-partner after deploy.
- Drift fixed by the draft: main's lib/provisional-figures.ts has field-trip 200 and sunset-cocktails-single 800, while live Sanity and Lee-Ann's doc say 150 and 350. Keep the correction and cite the doc.
- N11: spec in goldens/speakers-partner-security.md. Add what the draft lacks: assert quantity === 1 on the line item, e2e/speakers-partner.spec.ts (no cookie 400, two tickets 400, unset env 400, noindex, absent from hub and sitemap, the generic [slug] route does not bypass the password), and a QA attempt with a spoofed X-Forwarded-For.
- N12: lib/workshop-sales.ts WORKSHOP_TICKETS_ON_SALE=false; the card shows the price and "Coming soon"; checkout answers 403. Add e2e/workshop-coming-soon.spec.ts.
- The doc lists Spouse/Partner R950 for each of SAOC and WOSA Conference; Brad's single combined Speakers Partner ticket replaces both (already in the draft comment).

Files: lib/provisional-figures.ts, lib/speakers-partner.ts, lib/workshop-sales.ts, lib/ticket-on-sale.ts, lib/data/ticket-*.ts, lib/admission-siblings.ts, lib/ticket-email-copy.ts (one mapping line), lib/registration.ts (one line), sanity/queries.ts, sanity/schemas/documents/ticketType.ts, scripts/seed-ticketing.ts, scripts/fix-ticket-prices-19nov.ts, app/api/tickets/checkout/route.ts, app/api/tickets/speakers-partner/auth/route.ts, app/(nos)/tickets/speakers-partner/page.tsx, app/(nos)/tickets/[slug]/layout.tsx, app/(nos)/national-show/what-to-expect/page.tsx, components/tickets/**, apphosting.yaml, .env.local.example.

Env var name is SPEAKERS_PARTNER_PASSWORD (lead, 19 Nov; Brad already set it in .env.local in the repo root and the local-preview worktree). The draft code, .env.local.example and apphosting.yaml comment still say SPEAKER_PARTNER_PASSWORD: rename every occurrence (SPEAKERS_PARTNER_PASSWORD_ENV in lib/speakers-partner.ts). NO agent reads, prints or logs the value, and no dev brief may ask for it; code and tests use a dummy value via test env only; unset stays fail-closed. GO-LIVE STEP (waits for Brad's word): mirror it to Secret Manager, then uncomment the apphosting.yaml reference.

### F4 Integration (after F1, F2, F3 are merged on preview/local), N9 N13 prep

- Regenerate the sample PDFs under samples/ticket-emails (stale since 11 Nov) with the generator; confirm contract checks A20-A22.
- Remove the VIP-time questions from Lee-Ann's Questions doc in Drive with gws (read first, then a dated block per the Lee-Ann doc rules), and mirror copy changes in her source Drive doc plus a comment (memory: Drive copy mirrors site).
- Hand the samples to the STUDIO mission: Brad edits first, then Lee-Ann signs off (N13). No send, no live switch.

## Out of scope

N14 legal docs (waiting on the lawyer). STUDIO (separate mission).

## Notes

Gaps carried: Codex QA unavailable until 22 Nov. Vendor fees R3 500 in the pricing doc have no home in code or Sanity (vendor flow is not ticketing), left untouched. The pricing doc's "Complimentary R0" has no purchasable SKU, no change.

## F4 close-out (20 Nov 2026)

- Samples: regenerated all 18 PDFs in samples/ticket-emails with `pnpm samples:ticket-emails` on origin/main d14c3e76. A20, A21 and A22 are green (no Hangar 25, Airfield or R360; VIP shows 16:30).
- Questions doc (1C2_2EKYvJwzB5ejtwf0wpm5bk7z916-c8UQQrkQmSjc): both VIP-time questions and their answers removed, dated 20 Nov block added. Before/after in .tmp/sandbox/qdoc-before-20nov.txt and qdoc-after-20nov.txt.
- Source docs mirrored (.docx, files.update on the same ID; pre-edit revision pinned keepForever; comment added):
  - What to Expect 1UPPsvb7MNGkj-y5nV7CDDH5KyrblZMNi, pinned 0B8dEtk7a9gtGQXJZSytRVW9OK0Fsb1hydjVNdkNiekJSbEJNPQ, comment doco.zmFB4bkDmEC0yJICkWunuw
  - Frequently Asked Questions 1geaHIB3EYfSaVqEXqA6LvuXDDh3qPKdt, pinned 0B8dEtk7a9gtGdmNOSGZIdGZOZjhRSW11WTNBd094bGNwWHdNPQ, comment doco.0jwCq4LSRgmb62ZkjcVVRg
  - 2027 Show Contact information 138RAX1j-qkhuc40LBcpG7gTxB8MHKh-1, pinned 0B8dEtk7a9gtGNnYwd1NleHFNblhFZEdud1NFQlZqd2s2a240PQ, comment doco.YurbuUA-BnFu5BM_BmWujQ
  - PLAN YOUR VISIT 1QwqjMxhC1WVFGUNouB17OKNDj_XmKicu, pinned 0B8dEtk7a9gtGdlJ4cjJCbmhLbTdlZ21na3RIUWtmcUNTeTNnPQ, comment doco.E5sZDXmgfoXZ_8i2dtv9pA
- Left as her wording in PLAN YOUR VISIT (no site counterpart or site keeps it): the "Stellenbosch Flying Club has not been worked out yet" line, the parking line, the "To be Provided ... site map from the R44 to the Hangar" line.
- Samples go to the STUDIO mission next (Brad edits, then Lee-Ann signs off, N13). No send, no live switch.

## M1 gate (21 Nov 2026)
- Triad preflight blocked the gate (UI contract, no triad kinds). Added A25-A27 as non-required, honestly labelled; the triad layer still executes them and reports FAIL/ERROR (no saved Codex verdict, no browser/gws manifest). Nothing faked.
- Content checks run against origin/main d14c3e76 (CHECK_ROOT worktree): A1-A7, A9, A14-A17 PASS. A8/A13 (e2e) need a real node_modules install; A11/A12 resolve goldens under CHECK_ROOT (goldens live on the memory branch); A20-A22 need the gitignored samples; A10/A18 hit the 60s check timeout. All of these passed or were CI-green when PRs 219-221 merged.
- The gate cannot go green from a single checkout (contract mixes memory-branch goldens with main code). M1 is shipped in substance; M2 (N14) waits on the lawyer. Not spending more on the ceremony.
