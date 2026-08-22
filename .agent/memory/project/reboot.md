# Reboot Context
_Generated: 2026-08-22T01:47Z_

## What happened last session
Closed fix-live-sentinel-residue-cms-loop-f3: root cause was A1 and show-visitor-info's mutation guard mutating the live nationalShow singleton under two different, non-shared lock files, so they never actually serialized — plus three related draft-cleanup data-loss bugs found across Codex rounds 6-9. Shipped a shared docLockPath(docId), retrofitted A1 with poisoned-baseline rejection + revision-guarded restore, wired the dataset-residue scanner into contract.py's gate_cmd as a blocking pre/post-flight check, and swept/restored live production. Gate 15/15 green, qa-apex PASS, 10 Codex GPT-5.5 rounds (final clean).
