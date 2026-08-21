---
schema: athanor.mission/v1
slug: backlog-sweep-2-dead-links-and-a11y
goal: 'Backlog sweep 2: five more independently-scoped fixes from the QA sweep with
  no Brad blocker and an existing in-codebase pattern to reuse. F1: /about page''s
  WOSA link resolves to wosa.co.za (Wines of South Africa, wrong site entirely) —
  fix to wildorchids.co.za, same as the Footer.tsx fix already shipped. F2: public
  /events.ics route 404s while the real working feed lives at /api/events.ics — add
  a redirect or route re-export so the public URL works. F3: /constitution is missing
  the ''AI-generated draft, not legal advice'' disclaimer already present on /privacy,
  /terms, /refunds — add the same disclaimer component/copy. F4: /national-show/archive
  index''s 5 edition cards are non-interactive divs, not real links or keyboard-focusable
  — convert to real anchor/Link elements (detail pages already work fine via direct
  URL, this is purely the index page''s card markup). F5: vendor registration form
  (/national-show/vendors/register) silently fails on invalid email format with zero
  visible error/feedback — add real inline validation feedback matching the site''s
  existing form-error patterns (the same bordered-callout pattern already used on
  ContactForm/TicketPurchaseForm from the previous mission). All sourced directly
  from the QA sweep findings and .agent/memory/project/backlog.md.'
created_at: '2026-08-21T22:33:09.940744+00:00'
started_at: '2026-08-21T22:40:00+00:00'
completed_at: '2026-08-22T00:00:00+00:00'
last_active_at: '2026-08-22T00:00:00+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F5
  ts: '2026-08-22T00:00:00+00:00'
features:
- id: F1
  status: done
  tier: standard
  title: /about WOSA link points at wosa.co.za (Wines of South Africa, wrong site)
  inline_brief: 'app/(marketing)/about/page.tsx:126 links href="https://wosa.co.za"
    -- Wines of South Africa, an unrelated organisation -- where it means to link
    the real WOSA (Wild Orchids of Southern Africa) at https://wildorchids.co.za.
    Same fix class as the Footer.tsx WOSA link already corrected in the previous
    mission (backlog-a11y-ui-quickfixes F1). One-line href fix only -- do not touch
    WOSA''s own content or add any wild-orchid-conservation copy, per this project''s
    CLAUDE.md scope boundary (SAOC is cultivation, not conservation).'
  contract: .agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/goldens/m1-golden.md
- id: F2
  status: done
  tier: standard
  title: Public /events.ics 404s -- real feed lives at /api/events.ics
  inline_brief: 'The working ICS feed is app/api/events.ics/route.ts (GET /api/events.ics,
    text/calendar, Content-Disposition attachment). The public-facing /events.ics URL
    (the kind of path a calendar-subscription link or documentation would naturally use)
    currently 404s -- there is no app/events.ics route or redirect. Add a next.config.ts
    redirects() entry mapping source "/events.ics" to destination "/api/events.ics"
    (permanent: false -- it is an alias, not a URL that moved). Do not duplicate the feed
    logic into a second route -- one implementation, the public URL just needs to resolve
    to it. No prior design doc (execution/contracts/C4_ics_export.md) prohibits a public
    alias; its "do not create a route.ts named with an extension" note is about the
    /api/events.ics implementation''s folder naming, not about this redirect.'
  contract: .agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/goldens/m1-golden.md
- id: F3
  status: done
  tier: standard
  title: /constitution missing the AI-draft/not-legal-advice disclaimer
  inline_brief: '/privacy, /terms, and /refunds each open their content column with an
    identical inline JSX disclaimer block (there is no shared component -- it is
    copy-pasted verbatim in each page.tsx): a `border border-rule bg-primary/5 px-6 py-5`
    section containing "Draft pending legal review. This page has been drafted with AI
    assistance and has not yet been reviewed by a qualified legal professional. It does
    not constitute legal advice and should not be relied upon as SAOC''s final policy
    until formal review is complete." /constitution (app/(marketing)/constitution/page.tsx)
    has no such block despite being exactly the same kind of AI-drafted governance
    document. Add the identical block (same markup/classes/copy) as the first section
    inside /constitution''s content column, matching the other three pages'' placement.'
  contract: .agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/goldens/m1-golden.md
- id: F4
  status: done
  tier: standard
  title: /national-show/archive index cards are non-interactive, unlinked divs
  inline_brief: 'app/(marketing)/national-show/archive/page.tsx''s show grid renders each
    past show as a bare `<div key={show.year}>` with no href, no onClick, and no
    router.push -- verified by reading the file: there is no navigation at all today, not
    even an inaccessible one. app/(marketing)/national-show/archive/[year]/page.tsx
    already exists and works fine via a direct URL (/national-show/archive/{year}).
    Convert each card''s outer element from `<div key={show.year} ...>` to
    `<Link key={show.year} href={`/national-show/archive/${show.year}`} ...>`
    (Link is already imported in this file), keeping all existing inner markup/classes
    unchanged, and add the site''s standard focus-visible ring
    (focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40
    focus-visible:ring-offset-2 focus-visible:ring-offset-parchment -- parchment because
    that''s the card''s own bg-parchment, matching the site''s per-background offset
    convention from the previous mission) to the new Link.'
  contract: .agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/goldens/m1-golden.md
- id: F5
  status: done
  tier: standard
  title: Vendor registration form has no email-format validation or visible feedback
  inline_brief: 'Confirmed by reading lib/vendor-register-form-validation.ts (client) and
    lib/vendor-submissions.ts''s validateVendorSubmissionInput (server): neither checks
    contactEmail for anything beyond non-empty -- an obviously-malformed address (e.g.
    "notanemail") passes both and is silently accepted with no error shown anywhere.
    Add a simple format check (a plain regex like /^[^\s@]+@[^\s@]+\.[^\s@]+$/ is enough,
    this is UX validation not RFC 5322 compliance) to BOTH validators, pushing the error
    string "contactEmail must be a valid email address" when the trimmed value is
    non-empty but not email-shaped -- that exact wording does not match any of
    humaniseFieldError''s (lib/vendor-register-response.ts) special-cased substrings
    ("must be true" / "is required" / "invalid value"), so it already falls through to
    the existing generic "Email address is invalid." message with zero changes needed
    there. Separately, VendorRegisterStatusBanner.tsx currently renders errors with the
    low-contrast border-accent/40 bg-accent/5 + text-accent styling the previous mission
    (backlog-a11y-ui-quickfixes F3) already replaced on ContactForm.tsx and
    TicketPurchaseForm.tsx with a bordered callout: `border border-primary-800 bg-bone`
    + `text-primary-800`. Apply that same replacement here so the vendor form''s error
    feedback is both present (new email check) and legible (existing site-wide pattern).'
  contract: .agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/goldens/m1-golden.md
milestones:
- id: M1
  status: done
  gate_result: pass
  features: [F1, F2, F3, F4, F5]
---

# Mission: Backlog sweep 2: five more independently-scoped fixes from the QA sweep with no Brad blocker and an existing in-codebase pattern to reuse. F1: /about page's WOSA link resolves to wosa.co.za (Wines of South Africa, wrong site entirely) — fix to wildorchids.co.za, same as the Footer.tsx fix already shipped. F2: public /events.ics route 404s while the real working feed lives at /api/events.ics — add a redirect or route re-export so the public URL works. F3: /constitution is missing the 'AI-generated draft, not legal advice' disclaimer already present on /privacy, /terms, /refunds — add the same disclaimer component/copy. F4: /national-show/archive index's 5 edition cards are non-interactive divs, not real links or keyboard-focusable — convert to real anchor/Link elements (detail pages already work fine via direct URL, this is purely the index page's card markup). F5: vendor registration form (/national-show/vendors/register) silently fails on invalid email format with zero visible error/feedback — add real inline validation feedback matching the site's existing form-error patterns (the same bordered-callout pattern already used on ContactForm/TicketPurchaseForm from the previous mission). All sourced directly from the QA sweep findings and .agent/memory/project/backlog.md.

## Context

(Add context here)

## Notes

