---
schema: athanor.mission/v1
slug: ticket-email-samples
goal: Per-ticket-type confirmation emails and ticket PDF built from Lee-Ann's 'Ticket
  information for purchasers.docx', rendered through the real system as sample PDFs
  for Lee-Ann's approval; nothing sent and nothing live until she approves (Brad 2026-11-10)
created_at: '2026-11-10T10:59:53.605710+00:00'
started_at: null
last_active_at: '2026-11-18T09:33:31.120939+00:00'
status: pending
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M2
  feature: F3
  ts: '2026-11-18T09:33:31.120939+00:00'
features:
- id: F1
  name: Per-type email copy, template, input fields and default-off switch (TICKET_TYPE_EMAILS_LIVE)
  milestone: M1
  status: done
  spec: .agent/memory/project/specs/ticket-email-samples/contract.yaml
  completed_at: '2026-11-18T09:33:28.758705+00:00'
- id: F2
  name: Sample generator producing 8 email PDFs and 8 ticket PDFs from fixture data
  milestone: M2
  status: done
  spec: .agent/memory/project/specs/ticket-email-samples/contract.yaml
  completed_at: '2026-11-18T09:33:30.253468+00:00'
- id: F3
  name: Questions for Lee-Ann cover page and combined PDF
  milestone: M2
  status: done
  spec: .agent/memory/project/specs/ticket-email-samples/contract.yaml
  completed_at: '2026-11-18T09:33:31.120778+00:00'
milestones:
- id: M1
  features:
  - F1
  name: Per-type emails behind a default-off switch
  status: pending
  gate_ran_at: '2026-11-18T09:35:09.244944+00:00'
  gate_result: fail
- id: M2
  features:
  - F2
  - F3
  name: Sample PDFs and cover page for Lee-Ann
  status: pending
force_orphaned_at: '2026-11-19T17:31:03.916880+00:00'
---

# Mission: Per-ticket-type confirmation emails and ticket PDF built from Lee-Ann's 'Ticket information for purchasers.docx', rendered through the real system as sample PDFs for Lee-Ann's approval; nothing sent and nothing live until she approves (Brad 2026-11-10)

## Context

Contract and goldens: .agent/memory/project/specs/ticket-email-samples/. Copy source: Lee-Ann's 'Ticket information for purchasers.docx' (frozen with sha256). Sample output goes to samples/ticket-emails/. Nothing is sent and the switch stays off until Lee-Ann approves (Brad 2026-11-10).

## Notes

