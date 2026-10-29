# Adversarial review: nos-recovery-ttl (F1)

Read in the repo you are run in (the PR worktree, no other checkout): `.agent/memory/project/specs/nos-recovery-ttl/spec.md` (D1-D9, hunk list), the goldens in `.agent/memory/project/specs/nos-recovery-ttl/goldens/`, and `git diff origin/main...HEAD`.

Threat model, fixed: report PRODUCT defects in the diff only. The unit goldens (recovery-expiry, recovery-mint, checkout-mint-site, which execute the real code and the real route regions) count as coverage: do not report "route.ts is not exercised end to end" or "no integration test". Environment limits (no Firestore, no Sanity, stale node_modules, tsc/build errors in files the diff does not touch, the pre-existing failure of check-fail-closed-secret-guard.sh) are not findings. Do not re-open decisions D1-D9, including keeping the 180-day constant exported and keeping already-minted tokens (D6, D7).

Output line 1 exactly `PASS` or `FAIL`, then findings, each with file:line and the smallest input that shows it.

1. Rule: for any show end instant, is expiry the SAST midnight beginning end-day+8, never earlier than end+7 days, independent of server TZ and of mint time? Find an input where a buyer is cut short, or where Date arithmetic is wrong (month, year, leap, 2100).
2. Fail closed: can ANY path mint or write an order when the show window is null, the end date unparseable, or the window closed? Is there any fallback, default, `??` or catch that yields an expiry? Does the guard run before every Firestore write and gateway call, and after the secret guard?
3. Mint site: does the token written to the order carry exactly the computed expiry (token payload `e`, `recoveryToken`, `recoveryTokenExpiresAt` Timestamp all consistent)? Can a transaction retry mint with a stale or different expiry, or write a born-expired token?
4. Verify side and recovery page: confirm lib/recovery-access.ts, verifyRecoveryToken and /tickets/recover are untouched and an expired token still yields the identical 404.
5. Logs and copy: is anything but the refusal code logged (no secret, token, show date, order data)? Any new user-facing string?
6. Scope: every touched file on the hunk list; route.ts diff additions-only and within the 5 hunks; no new Sanity or Firestore read or write; no other minter of recovery tokens.
7. Tests: run the goldens (expiry under TZ=UTC and TZ=America/Los_Angeles), `python3 .agent/memory/project/specs/nos-recovery-ttl/goldens/run_mutations.py`, and the wiring checks. Name any check that would pass for a wrong implementation with the same text.
