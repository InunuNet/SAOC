# leeann-content-build: goldens

Source of truth is `source/*.txt`: byte copies of the Drive extracts of Lee-Ann's 24 Oct 2026 documents
(privacy, terms, constitution, faq, plan-your-visit, what-to-expect, about, contact, exhibitors). The change
list is `.agent/memory/project/specs/leeann-answers-2026-10-24/change-list.md` (sections B, C, D, F).
`decisions.md` is the architect's binding reading of it, including every "until she answers we will" default.

## Milestones and PRs

| milestone | contracts | PR | risk |
|---|---|---|---|
| M1 | contract-f1.yaml (FC legal pages), contract-f2.yaml (FE ticket PDF and email) | one PR | low, high value |
| M2 | contract-f3.yaml (FD FAQ, Plan Your Visit, What to Expect, Contact, About), contract-f4.yaml (FF stats, partners, vendors merge) | second PR, branched after M1 merges | medium |

FB (naming, ticket names) is out of scope and waits on Q-D1 and Q-D2. The 79 live FAQ documents, the schema
deploy and every other Sanity write (FA) are the coordinator's, with a dataset backup. The dev ships code and a
dry-run seed script, never a live write.

## How the checks work

All checks are `pnpm exec tsx contracts/checks/leeann-content/<f>.mts <cmd>`. Exit 0 pass, 1 fail, 2 bad usage.

- Verbatim means every character of her block appears in the rendered text, in order, ignoring whitespace only.
  Her struck-through text (her own "replace this" markers) is not part of the target. A changed apostrophe, a
  corrected typo or a dropped clause fails.
- Phantom check: every rendered block must be a piece of her text or named chrome (an eyebrow). The old
  AI-drafted wording fails here.
- Render checks start `next dev` on port 3071 with `BETA_PASSWORD_WALL_OFF=true`, or reuse a server you already
  run: start it the same way and set `LEEANN_BASE_PORT`. `next dev` rewrites `AGENTS.md`; do not commit that.
- `pnpm build` needs the site origins: `NEXT_PUBLIC_SAOC_SITE_URL` and `NEXT_PUBLIC_NOS_SITE_URL` (the contract
  commands set them) and a `.env.local` copied into the worktree (gitignored).
- ticket-pdf checks cache `.tmp/sandbox/ticket-pdf/fixture.pdf`; delete it after a fixture change.
- Typos in her documents are published as written. If she approves a correction, add
  `{doc, from, to}` to `typo-corrections.json` (architect or orchestrator); the checks then expect the corrected text.

## What the architect already changed outside this folder

- `contracts/checks/ticket-pdf/check-ticket-pdf.mts` (`schedule`): Symposium and WOSA now expect their product dates.
- `.agent/memory/project/specs/ticket-pdf/goldens/fixture-order.json`: the Symposium position carries its date.
- `.agent/memory/project/specs/ticket-pdf/goldens/copy-baseline/allowed-strings.txt`: her new strings.

The ticket-pdf `copy` check is red on this machine before any change (stray letters t e s i n g o l y v from
the Testing-only mark). It is not part of these contracts.

## Existing checks that pin copy this work replaces

The dev lists each one it edits in `.agent/memory/project/specs/leeann-content-build/checks-updated.md` (path
and reason), or the scope guard fails. Known candidates: `contracts/checks/policy-pages/check-legal-draft-notice.mjs`,
`check-terms-ticket-conditions.mjs`, `check-privacy-content.mjs` (the old refunds-cancellation-terms contract);
`contracts/checks/launch-weekend/f17/check-c-nav-labels.mjs`, `f18/check-g-ledes.mjs`, `f18/check-c-holding.mjs`;
`contracts/checks/menu-system-layout4-shared/check-nav-links-200-gated-by-exemptions.mjs`;
`contracts/checks/nos-provenance-fix/*` and `trace-excludes/*` (sa-exhibitors); `contracts/checks/show-visitor-info/check-faq-grouping.mjs`;
`contracts/checks/vendor-f3-showcase-page` intro fixtures (v1.0 intro; `components/vendors/VendorIntro.tsx` stays untouched unless the NOS route imports it);
`contracts/checks/saoc-seo-polish/check-page-metadata.mjs`; `contracts/golden/f6-home-fidelity/*` (stat tiles).
Run `grep -rln` for the removed strings before claiming done.
