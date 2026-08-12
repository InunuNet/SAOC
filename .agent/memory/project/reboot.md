# Reboot Context
_Generated: 2026-08-12T03:49Z_

## What happened last session
Overnight four-stream session, all shipped in commit be80580 (214 files): (A) ticketing security hardening 37/37 with @qa PASS — door scanner now fails closed on every unenumerated state via lib/checkin.ts, capacity is a Firestore transaction (1x201/19x409 at 20-way concurrency), booking refs 60-bit crypto-random, checkout idempotency bound to buyer+payload, abandoned reservations released on a TTL that can never expire a paid ticket, SITE_URL declared in apphosting.yaml; (B) show-visitor-info 72/72 — nationalShow singleton now drives show identity across all seven surfaces (it previously drove none, so a venue swap rendered two venues in one viewport), plus Plan Your Visit / What to Expect / FAQ; (C) cms-wiring-cleanup 14/14 @qa PASS; (D) show-exhibitor-info 52/52. The durable lesson outranks the features: an assertion that sources its expected value from the same place as the actual value cannot fail — six instances found, several green while the rule they existed to enforce was violated. Countermeasure now standard: negative-control every new assertion against the unfixed tree before @dev starts. The gate itself corrupted the live Sanity dataset three times (mutating checks with no timeout_seconds, SIGKILLed mid-mutation after the sentinel write and before the restore; once a sentinel rendered publicly for ~4.5h). Two harness bugs filed upstream: InunuNet/Athanor#1337 (contract.py drops the CLI --timeout-seconds override for sub-phases under --phase all; per-assertion timeouts DO survive) and #1338 (GATE BLOCKED file omits reason, artefact path, trend and mission id). Open and unfixed: @qa round-2 findings R2-1..R2-5 on ticketing, B and D round-2 fixes never re-reviewed by @qa, exhibitorStages retirement deadlocked across two contracts, show.awards lost its rendered surface, no SAOC-side notification for contact-form enquiries, seed-page-singletons.ts still uses destructive createOrReplace. No closure candidates: InunuNet/SAOC has zero open GitHub issues, and gh_closure_scan.py aborts on a missions/ file without frontmatter. Brad-blocking: Firebase Auth unprovisioned on saoc-webapp (admin and door scanner dead everywhere), and the committee still owes prices, capacity, venue, dates and all exhibitor rules.

---

## UPDATE — 06:35, session close (supersedes the 03:49 entry above where they differ)

**Four commits, tree clean, all four contracts green ON THE COMMITTED STATE:**
`be80580` (the four streams) → `f5d2ef8` (exhibitorStages retirement + dataset-mutation
safety) → `e8c3fd4` (incident record) → `833aa85` (failure-mode synthesis).
Ticketing 37/37 (×2 runs), visitor **74/74** clean single-pass, CMS 14/14, exhibitor 52/52.
Verified quiescent afterwards: all documents scanned by a recursive string walk, **0 sentinels**,
`nationalShow` fully at baseline, **no lock files**, all 8 public pages 200 with no sentinel text.

**Three things the 03:49 entry does not know:**

1. **The `exhibitorStages` retirement COMPLETED** — it is not deadlocked. The deadlock had three
   sides: `contract-show-visitor-info` A5 (amended), `cms-loop-f3-national-show` A3 (retired in
   place, subject no longer exists, A77 named as replacement), and A69 (never at risk — only the
   Sanity read path went; the static `EXHIBITOR_STAGES` block stayed). New **A77** asserts the
   retirement is *complete* across schema, query and read path. `defined(exhibitorStages)` = 0.
   Open follow-up: `cms-loop-f3-national-show` A5 is red for a *sanctioned* reason (this session
   legitimately added `showEndDate`/`edition`/`hostRegion`/`venue`) — that contract needs a scope
   review, not a one-line patch. Logged in backlog.

2. **A fourth dataset incident, caused by the orchestrator.** I sent SIGTERM to a long-running
   gate mid-A61; the restore did not complete and `SVI-SWEEPVENUE-SENTINEL-…` went live on
   `/national-show`, with `hostRegion`, `edition` and both dates corrupted too. Restored from
   `scripts/seed-show-visitor-info.ts` baselines and verified. **A slow gate is not a hung gate**
   — ceilings are now A61 1200s with a 420s lock wait, so tens of minutes is normal. Two agents
   warned me in writing before I did it.
   **And the sweep I had been verifying with all night was a false negative:**
   `pt::text(@) match "*SENTINEL*"` only reads portable text and cannot see plain string fields,
   which is where every incident landed. Use a recursive walk over all string values instead —
   `(await c.fetch('*[]')).filter(d => JSON.stringify(d).includes('SENTINEL'))`. Every
   "dataset clean" reported before ~06:07 was unreliable.

3. **A third harness bug filed: InunuNet/Athanor#1339** — `contract.py` records an exit-3
   BLOCKED check as `verdict: fail`, so a check that never ran is indistinguishable from a
   defect. Joins #1337 (`--phase all` drops the CLI `--timeout-seconds` override) and #1338.
   **Practical consequence until fixed: serialise gates.** Two agents gating the same contract
   cannot both get a clean result now that read-only checks also take the dataset lock. Every
   contended red this session was disproved standalone.

**Still open** (unchanged): @qa round-2 findings R2-1…R2-5 on ticketing; B and D round-2 fixes
never re-reviewed by @qa; `seed-page-singletons.ts` still uses destructive `createOrReplace`.
**Brad-blocking** (unchanged): Firebase Auth unprovisioned on `saoc-webapp` — `/admin` and the
door scanner dead in every environment; committee owes prices, capacity, venue, dates and all
exhibitor rules.
