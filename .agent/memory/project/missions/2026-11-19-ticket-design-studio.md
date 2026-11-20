---
schema: athanor.mission/v1
slug: ticket-design-studio
goal: 'Email and ticket-PDF design studio: live-preview controls within the approved
  handoff tokens, wired to the real render path, piloted on one ticket type for Brad,
  feeding N13 sample sign-off'
created_at: '2026-11-19T17:31:03.919985+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  name: Design object and settings JSON threaded through the one email renderer and the one ticket PDF renderer, defaults byte-identical
  milestone: M1
  status: pending
  spec: .agent/memory/project/specs/ticket-design-studio/contract.yaml
- id: F2
  name: Studio page and preview/save APIs behind admin session and dev-only flag, VIP pilot
  milestone: M1
  status: pending
  spec: .agent/memory/project/specs/ticket-design-studio/contract.yaml
- id: F3
  name: Per-type sample export button plus docs, VIP pilot
  milestone: M1
  status: pending
  spec: .agent/memory/project/specs/ticket-design-studio/contract.yaml
- id: F4
  name: Rollout to every ticket type key in TICKET_EMAIL_COPY with a type picker
  milestone: M2
  status: pending
  spec: .agent/memory/project/specs/ticket-design-studio/contract.yaml
- id: F5
  name: Fresh sample export of all types for N13 sign-off
  milestone: M2
  status: pending
  spec: .agent/memory/project/specs/ticket-design-studio/contract.yaml
milestones:
- id: M1
  name: Pilot on the VIP ticket, previewable on dev.saoc.co.za
  features:
  - F1
  - F2
  - F3
  status: pending
- id: M2
  name: Rollout to all ticket types and fresh samples for N13
  features:
  - F4
  - F5
  status: pending
force_orphaned_at: '2026-11-19T17:31:06.777910+00:00'
---

# Mission: Email and ticket-PDF design studio: live-preview controls within the approved handoff tokens, wired to the real render path, piloted on one ticket type for Brad, feeding N13 sample sign-off

## Context

Contract and goldens: .agent/memory/project/specs/ticket-design-studio/. Base branch for all dev work: preview/local (the per-type email code is not on main). Palette is the NOS set (royal, purple-700, gold, olive-700, ink) already in app/globals.css, EmailShell and the ticket-pdf layout-spec; no new colours or fonts (docs/rules/no-invention.md, design/design_handoff_saoc/, branding/National Show 2027/). Copy stays read-only and comes from lib/ticket-email-copy.ts (Lee-Ann's doc).

Pilot ticket: VIP (date plus time on the stub, soft-line-break copy, no pending rows, unaffected by the price and SKU changes in leeann-notes-19nov).

M1 features (Sonnet devs, sequential F1 then F2 then F3):
- F1 files: lib/ticket-design/{tokens,schema,index}.ts, lib/ticket-design/settings/vip.json, lib/ticket-pdf.ts, lib/ticket-type-email.ts, emails/TicketTypeConfirmation.tsx, emails/_shared/EmailShell.tsx. Accept A1-A6, A16.
- F2 files: app/admin/(shell)/studio/page.tsx, components/admin/studio/*, app/api/admin/studio/{preview-email,preview-pdf,save}/route.ts. Accept A7-A12, A16. Browser check on dev with TICKET_STUDIO_ENABLED=1.
- F3 files: app/api/admin/studio/export/route.ts, scripts/generate-ticket-email-samples.ts (export a per-key function only), docs/ticket-design-studio.md. Accept A14-A15, A16.
M2: F4 after leeann-notes-19nov lands (key list changes: Speakers Partner added, Weekend Pass early bird removed); F5 regenerates samples.

Collision with leeann-notes-19nov: lib/ticket-email-copy.ts, lib/show-contact.ts, lib/ticket-offers.ts, scripts/ticket-email-sample-fixtures.ts (venue literal). This mission must not edit them (A13).
Note: preview/local has TICKET_TYPE_EMAILS_LIVE = true (commit 3aa6f7fe); backup/preview-local-20261117 and the original contract had false. This mission leaves the switch untouched.


## Notes

