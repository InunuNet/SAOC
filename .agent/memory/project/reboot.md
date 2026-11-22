# Reboot Context
_Generated: 2026-11-22T02:52Z_

## What happened last session
Backend hardening audit mission (21-22 Nov 2026): security and structure audits, then six reviewed PRs merged to main: #227 display stock cache and capability checks on admin data routes with legacy no-roles fallback; #226 per-IP checkout rate limit, 503 on transient payment confirmation failures, reconcile 7-day window newest first, index orders(status ASC, expiresAt DESC) deployed; #228 sandbox banner cache that never caches a failed read, stale contract checks repaired or retired; #230 16KB notification body cap, vendor upload id-shape check, single-address email validation; #231 vendor code attempt cap atomic; #229 post-commit late-settlement flag and receiptEmail status record, automatic receipt retry dropped by lead ruling after three Codex FAILs.

## Top priorities
- Brad decisions: minInstances 1 costs about USD13/month (recommend 0 then verify cold start and an Ozow sandbox notification); prune Artifact Registry 7.7GB; order reference equals ticket 1 door code; CAPTCHA; vendor code is 4 digits; vendor upload authorised by id only; deployed maxScale 20 vs yaml 2; remove legacy no-roles admin fallback after admin-migrate-roles --apply; admin resend for failed receipts; Athanor 3.8.166 update. Pause at 12:00 SAST quota reset.

## Critical facts
- Gemini agy QA passed three payment-path versions Codex failed: require Codex for payment code. Reconcile cron is hourly. Local node_modules next 16.4.3 vs lockfile 16.4.6. About 320 of 445 older contract checks fail on main, sampled as env-dependent or stale, none real. Brad 22 Nov: lead recommendation decides technical calls.
