# nos-hero-lockup — RESUME (paused 2026-09-29 by Brad: moving locations)

Branch: feat/nos-hero-lockup. Nothing merged, nothing deployed to beta. Merge waits on Brad's screenshot sign-off.

## Done
- F1 hero: complete. Gate 30/30. Codi PASS. Docs 9219d10f. Lede rewritten per Brad (c27c351e).
- F2 page deltas (contract-f2.yaml, 34 assertions, committed 5ad0e059): items 3,4,5,6,7,9 shipped & accepted by Codi
  (commits 638a6520 f3017139 3ad38ef6 d6253166 349cb86a 80ef95c3 06568d5d). Item 9 CLOSED (Codi's unfocused extension tabs); paint probe fixed for QA false-pass (06568d5d).

## At pause
- F2 item 2 resize DONE: 80d8f8bd (Logo.tsx responsive 440px >=620 / vertical min(340px,100vw-64px) below; colophon call site orientation="responsive"). Gates f1 30/30, f2 34/34.
- Cap height: 1280 = 7.07px both (pass). 390 = ~6.57px both (FAILS the 7px floor). Even the vertical file at its 340px max only reaches ~6.9px; ~360px+ width needed. OPEN for Codi/Brad: raise the vertical cap or relax 7px for the vertical file. Not yet sent to Codi.
- Screenshots: .tmp/sandbox/nos-hero-lockup/review/f2/{masthead,colophon}-{1280,390}.png -> send to Codi with the cap-height flag.
- Re-create hero-{1280,390,1714}.png (sandbox partly wiped, capture.mjs gone).
- Dev server: @dev restarted :3002 after a wedged image request; that explains the server exit.
- Then: Codex QA of 40077970..HEAD (use saved diff + `< /dev/null`), @docs for F2, @maintainer, Brad sign-off, merge, beta rollout + verify.

## Held / open
- Item 1 fonts: HOLD for Brad (committee PDF says Cormorant+Jost vs R14 Fraunces+Karla).
- Item 8 dl hairline: DROPPED (olive rules stay; A19 guards).
- Header icon buttons 44px: menu lane (saoc-85) logged it.
- Below-hero restructure: proposal awaiting Brad.
- Sandbox .tmp/sandbox/nos-hero-lockup partly deleted — cause unconfirmed (asked @dev).
Sources: .agent/memory/scratch/rulings-inbox/codi-*.md, brad-hero-lede-2026-09-29.md.
