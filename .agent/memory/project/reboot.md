# Reboot Context
_Generated: 2026-11-22T12:14Z_

## What happened last session
22 Nov day session: harness updated to 3.8.167; backlog triaged 156 -> ~115 open (49 archived with evidence); merged #232 streamed body cap on 15 public POST routes, #233 nine Sanity one-off scripts flipped to --apply, #234 16 KiB cap on vendor stand-payment notification + admin-session-body cancel fix. All Codex+Gemini PASS, beta pages 200 after each. Stale branches fix/sec-abuse-controls and fix/sec-stand-orders analysed: retire, re-implement gaps fresh.

## Top priorities
- Waiting on Brad: go for held-seat budget mission (P1 before 1 Dec); delete two stale remote branches; close obsolete PR #188; earlier list (minInstances, registry prune, CAPTCHA, vendor code length). Unblocked small items: 12 KNOWN_UNGATED scripts, A10 check exact mode, nos-content-standard checks.sha256 pins.

## Critical facts
- Scratch dir is gitignored: QA reports there are local only. qa.sh Gemini cannot run git/ls; give it full file copies in scratch. readBodyTextWithinLimit must not await reader.cancel().
