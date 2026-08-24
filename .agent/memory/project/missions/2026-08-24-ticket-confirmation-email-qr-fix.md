---
schema: athanor.mission/v1
slug: ticket-confirmation-email-qr-fix
goal: 'Fix the ticket confirmation email''s QR code rendering as a broken-image placeholder
  in Gmail (and likely other clients that proxy/strip remote images). QR generation
  itself is correct — it renders fine on the confirmation page and in the downloaded
  ticket file — this is an email-delivery-specific defect. Likely cause: the email
  currently references the QR by a data: URI or a remote URL that Gmail''s image proxy
  mishandles. Fix: switch to a CID-attached inline image (Resend supports attachments
  with a content id) so the QR is embedded directly in the email payload, not fetched/proxied.
  Any verification must check what the actually-delivered email contains (a real send
  to a real Gmail inbox, or equivalent), not just ''it renders in a browser preview
  of the template'' — that already passes today and is not proof of a fix. Route through
  @architect for a contract before implementation.'
created_at: '2026-08-24T19:40:12.047879+00:00'
started_at: '2026-08-24T19:48:09.740626+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-08-24T19:57:51.127317+00:00'
features:
- id: F1
  status: done
  title: Switch the confirmation email's QR from an inline "data:" URI to a Resend
    CID-referenced inline attachment, so Gmail (and any other client mishandling "data:"
    URIs in HTML email) displays the real QR instead of a broken-image placeholder.
    Full spec — contracts/golden/ticket-confirmation-email-qr-fix-f1/README.md.
  inline_brief: null
  spec: .agent/memory/project/specs/ticket-confirmation-email-qr-fix
  contract: .agent/memory/project/specs/ticket-confirmation-email-qr-fix/contract-f1.yaml
  started_at: '2026-08-24T19:48:09.740436+00:00'
  completed_at: '2026-08-24T19:57:51.127138+00:00'
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-24T19:57:47.541019+00:00'
  gate_result: pass
---





# Mission: Fix the ticket confirmation email's QR code rendering as a broken-image placeholder in Gmail (and likely other clients that proxy/strip remote images). QR generation itself is correct — it renders fine on the confirmation page and in the downloaded ticket file — this is an email-delivery-specific defect. Likely cause: the email currently references the QR by a data: URI or a remote URL that Gmail's image proxy mishandles. Fix: switch to a CID-attached inline image (Resend supports attachments with a content id) so the QR is embedded directly in the email payload, not fetched/proxied. Any verification must check what the actually-delivered email contains (a real send to a real Gmail inbox, or equivalent), not just 'it renders in a browser preview of the template' — that already passes today and is not proof of a fix. Route through @architect for a contract before implementation.

## Context

(Add context here)

## Notes

