---
schema: athanor.mission/v1
slug: vendor-form-label-readability
goal: 'Vendor form all-caps labels are hard to read: font-mono text-[11px] uppercase
  tracking-[0.16em] across five shared vendor form components. Contrast passes (5.24:1)
  -- the problem is 11px + uppercase + 1.76px letter-spacing combined, not colour.
  Brad authorized this fix directly. First check whether the treatment is scoped to
  vendor components only or shared site-wide; a fix must not silently diverge vendor
  form typography from the rest of the site. Recommended approach: keep the mono/letter-spacing
  character, drop uppercase for sentence case.'
created_at: '2026-08-25T12:18:06.702749+00:00'
started_at: null
status: close_out
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
  status: pending
  tier: standard
  title: Site-wide removal of uppercase from font-mono text-[11px] tracking-[0.16em]
    labels
  inline_brief: null
  contract: .agent/memory/project/specs/vendor-form-label-readability/contract-f1.yaml
  golden_files:
  - contracts/golden/vendor-form-label-readability-f1/README.md
  completed_at: null
  spec: .agent/memory/project/specs/vendor-form-label-readability/contract-f1.yaml
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-25T12:45:13.111152+00:00'
  gate_result: pass
---




# Mission: Vendor form all-caps labels are hard to read: font-mono text-[11px] uppercase tracking-[0.16em] across five shared vendor form components. Contrast passes (5.24:1) -- the problem is 11px + uppercase + 1.76px letter-spacing combined, not colour. Brad authorized this fix directly. First check whether the treatment is scoped to vendor components only or shared site-wide; a fix must not silently diverge vendor form typography from the rest of the site. Recommended approach: keep the mono/letter-spacing character, drop uppercase for sentence case.

## Context

Architect investigation (2026-08-25) found the exact class string `font-mono text-[11px]
uppercase tracking-[0.16em]` is NOT vendor-scoped: it appears in ~26 files / ~35 locations
across admin (app/admin/settings/page.tsx, app/admin/login/*, components/admin/*), tickets
(components/tickets/*), contact form (components/contact/ContactForm.tsx), show pages
(components/show/*), and marketing pages (societies, media-kit, contact, judging, terms,
privacy, constitution, refunds, national-show + archive/[year]), in addition to the 4 vendor
field components (VendorFormField.tsx, VendorRadioGroupField.tsx, VendorBooleanRadioField.tsx,
VendorCheckboxGroupField.tsx). No shared label component exists -- the class string is
duplicated literally everywhere. Orchestrator decision (2026-08-25): fix site-wide (all ~35
locations), per backlog.md's own unconditional "must not silently diverge from the rest of
the site" wording. Label text is already sentence-case in source everywhere checked --
`uppercase` is a pure CSS transform, so removing that one utility class is sufficient; no
label strings need editing. Fix is mechanical: remove `uppercase` only, keep font-mono and
tracking-[0.16em] unchanged, touch no color/contrast classes.

## Notes

