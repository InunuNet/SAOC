# nos-hero-lockup — RESUME (paused 2026-09-29 by Brad: moving locations)

Branch: feat/nos-hero-lockup. Nothing merged, nothing deployed to beta. Merge waits on Brad's screenshot sign-off.

## Done
- F1 hero: complete. Gate 30/30. Codi PASS. Docs 9219d10f. Lede rewritten per Brad (c27c351e).
- F2 page deltas (contract-f2.yaml, 34 assertions, committed 5ad0e059): items 3,4,5,6,7,9 shipped & accepted by Codi
  (commits 638a6520 f3017139 3ad38ef6 d6253166 349cb86a 80ef95c3 06568d5d). Item 9 CLOSED (Codi's unfocused extension tabs); paint probe fixed for QA false-pass (06568d5d).

## In flight at pause
- F2 item 2 resize (Codi review): masthead + colophon lockups 440px wide >=620px (horizontal), vertical at min(340px, 100vw - 64px) below 620. Dispatched to Dev_Son5_M1-F2_NosHeroLockup; check git log / git status for a `wip(nos)` commit or uncommitted edits.
- After resize: both gates (f1 30/30, f2 34/34), measure location-line cap height >=7px, screenshots masthead/colophon at 1280+390 -> Codi; re-create hero-{1280,390,1714}.png (sandbox was partly wiped, capture.mjs gone).
- Then: Codex QA of 40077970..HEAD (use saved diff + `< /dev/null`), @docs for F2, @maintainer, Brad sign-off, merge, beta rollout + verify.

## Held / open
- Item 1 fonts: HOLD for Brad (committee PDF says Cormorant+Jost vs R14 Fraunces+Karla).
- Item 8 dl hairline: DROPPED (olive rules stay; A19 guards).
- Header icon buttons 44px: menu lane (saoc-85) logged it.
- Below-hero restructure: proposal awaiting Brad.
- Dev server: something else holds :3002 (node pid 50082 at pause); sandbox .tmp/sandbox/nos-hero-lockup partly deleted — cause unconfirmed.
Sources: .agent/memory/scratch/rulings-inbox/codi-*.md, brad-hero-lede-2026-09-29.md.
