---
schema: athanor.mission/v1
slug: backend-hardening-audit
goal: Adversarial back-end security and structure audit; fix confirmed back-end issues
  only, no copy or look-and-feel changes (Brad 21 Nov 2026)
created_at: '2026-11-21T20:54:55.729467+00:00'
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
  name: Security and structure audits (read-only)
  milestone: M1
  inline_brief: see research-backend-security-audit.md and research-backend-structure-audit.md
    in .agent/memory/scratch
  status: done
- id: F2
  name: 'Ticket money path: checkout rate limit, notification 503 on transient plus
    timeout, reconcile age cap and limit, safe error logging'
  milestone: M2
  inline_brief: see research-backend-security-audit.md and research-backend-structure-audit.md
    in .agent/memory/scratch
  status: done
- id: F3
  name: Cached display stock reads, capability checks on admin data routes, next patch
    bump
  milestone: M2
  inline_brief: see research-backend-security-audit.md and research-backend-structure-audit.md
    in .agent/memory/scratch
  status: done
- id: F4
  name: Late-payment oversell flag and receipt-email failure record with bounded retry
  milestone: M3
  inline_brief: see research-backend-security-audit.md and research-backend-structure-audit.md
    in .agent/memory/scratch
  status: pending
- id: F5
  name: Cache remaining uncached stock and banner reads, early-bird cutoff SAST check,
    repair stale contract checks
  milestone: M3
  inline_brief: see research-backend-security-audit.md and research-backend-structure-audit.md
    in .agent/memory/scratch
  status: done
- id: F6
  name: 'Public endpoint hardening: vendor code lockout, vendor upload authorisation,
    notification body cap, contact recipient validation, revalidate secret in header'
  milestone: M4
  inline_brief: see research-backend-security-audit.md and research-backend-structure-audit.md
    in .agent/memory/scratch
  status: done
- id: F7
  name: Always-on instance cost evidence (read-only)
  milestone: M4
  inline_brief: see research-backend-security-audit.md and research-backend-structure-audit.md
    in .agent/memory/scratch
  status: done
milestones:
- id: M1
  name: Audit
  features:
  - F1
  status: pending
- id: M2
  name: First fix batch
  features:
  - F2
  - F3
  status: pending
- id: M3
  name: Second fix batch
  features:
  - F4
  - F5
  status: pending
- id: M4
  name: Third batch
  features:
  - F6
  - F7
  status: pending
---

# Mission: Adversarial back-end security and structure audit; fix confirmed back-end issues only, no copy or look-and-feel changes (Brad 21 Nov 2026)

## Context

(Add context here)

## Notes

22 Nov 2026: M2 shipped. PR #227 merged (69bfeae3): 60s display stock cache, capability checks on four admin data routes with a legacy no-roles fallback (remove after admin-migrate-roles --apply). PR #226 merged (5fb1250d): per-IP checkout limit, 503 on transient payment confirmation failures, reconcile 7-day window newest first, safe error logging. Firestore index orders (status ASC, expiresAt DESC) deployed and READY. Brad 22 Nov: lead recommendation decides technical calls.

22 Nov 2026 02:40: M3/M4 progress. Merged: #228 (9603726a) sandbox banner 60s cache that never caches a failed read, six stale contract checks repaired, two retired (exit 77). #230 (b8a29185) 16 KB notification body cap, vendor upload id-shape check, single-address email validation; the vendor lockout redesign was REMOVED as a net loss (4-digit code: needs a longer code or new reissue flow, operator decision). #231 (c677abac) vendor code attempt cap made atomic. Open: #229 (late-settlement flag after commit, receipt-email status and bounded retry, no Resend idempotency key by lead ruling) passed Opus QA except the key, key removed; awaiting Codex review scheduled 04:08, then merge and deploy index orders (receiptEmail.status ASC, purchasedAt DESC) from the PR branch file.
Held for Brad: minInstances 1 costs about US$13/month (research-min-instances-cost.md), recommend 0 with checks; Artifact Registry 7.7 GB prune; order reference equals ticket 1 door code; CAPTCHA; vendor code length; vendor upload bearer-id; deployed maxScale 20 vs yaml 2. Known: reconcile cron is hourly; local node_modules has next 16.4.3 vs lockfile 16.4.6; about 320 of 445 older contract checks fail on main, sample shows env-dependent or stale, no real failures. Pause at the 12:00 SAST quota reset per fleet notice.
