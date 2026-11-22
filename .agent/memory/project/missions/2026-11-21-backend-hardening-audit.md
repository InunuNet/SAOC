---
schema: athanor.mission/v1
slug: backend-hardening-audit
goal: Adversarial back-end security and structure audit; fix confirmed back-end issues
  only, no copy or look-and-feel changes (Brad 21 Nov 2026)
created_at: '2026-11-21T20:54:55.729467+00:00'
started_at: null
last_active_at: '2026-11-22T02:52:54.416310+00:00'
status: done
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
  status: done
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
  status: done
  gate_ran_at: '2026-11-22T02:52:53.812921+00:00'
  gate_result: pass
- id: M2
  name: First fix batch
  features:
  - F2
  - F3
  status: done
  gate_ran_at: '2026-11-22T02:52:53.878091+00:00'
  gate_result: pass
- id: M3
  name: Second fix batch
  features:
  - F4
  - F5
  status: done
  gate_ran_at: '2026-11-22T02:52:53.944549+00:00'
  gate_result: pass
- id: M4
  name: Third batch
  features:
  - F6
  - F7
  status: done
  gate_ran_at: '2026-11-22T02:52:54.012770+00:00'
  gate_result: pass
completed_at: '2026-11-22T02:52:54.416066+00:00'
---

# Mission: Adversarial back-end security and structure audit; fix confirmed back-end issues only, no copy or look-and-feel changes (Brad 21 Nov 2026)

## Context

(Add context here)

## Notes

22 Nov 2026: M2 shipped. PR #227 merged (69bfeae3): 60s display stock cache, capability checks on four admin data routes with a legacy no-roles fallback (remove after admin-migrate-roles --apply). PR #226 merged (5fb1250d): per-IP checkout limit, 503 on transient payment confirmation failures, reconcile 7-day window newest first, safe error logging. Firestore index orders (status ASC, expiresAt DESC) deployed and READY. Brad 22 Nov: lead recommendation decides technical calls.

22 Nov 2026 02:40: M3/M4 progress. Merged: #228 (9603726a) sandbox banner 60s cache that never caches a failed read, six stale contract checks repaired, two retired (exit 77). #230 (b8a29185) 16 KB notification body cap, vendor upload id-shape check, single-address email validation; the vendor lockout redesign was REMOVED as a net loss (4-digit code: needs a longer code or new reissue flow, operator decision). #231 (c677abac) vendor code attempt cap made atomic. Open: #229 (late-settlement flag after commit, receipt-email status and bounded retry, no Resend idempotency key by lead ruling) passed Opus QA except the key, key removed; awaiting Codex review scheduled 04:08, then merge and deploy index orders (receiptEmail.status ASC, purchasedAt DESC) from the PR branch file.
Held for Brad: minInstances 1 costs about US$13/month (research-min-instances-cost.md), recommend 0 with checks; Artifact Registry 7.7 GB prune; order reference equals ticket 1 door code; CAPTCHA; vendor code length; vendor upload bearer-id; deployed maxScale 20 vs yaml 2. Known: reconcile cron is hourly; local node_modules has next 16.4.3 vs lockfile 16.4.6; about 320 of 445 older contract checks fail on main, sample shows env-dependent or stale, no real failures. Pause at the 12:00 SAST quota reset per fleet notice.

22 Nov 2026 04:45: #229 merged (06f84fca), reduced by lead ruling after three Codex FAILs on the receipt retry: ships only the post-commit late-settlement flag (overCapacity null when the order holds a legacy undated day-shaped position) and a single time-capped receiptEmail status record. NO automatic receipt retry, NO reconcile route change, NO new index. Failed receipts are visible as receiptEmail.status == 'failed' and are resent manually; an admin resend is future work. Six PRs merged in this mission: #226 #227 #228 #229 #230 #231. Lesson: Gemini (agy) passed three versions Codex failed; treat an agy PASS on payment-path code as weak and require Codex.
