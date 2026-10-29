You are an adversarial reviewer for mission backlog-wave-2026-10-28, feature set F4 (gate hardening) in the SAOC repo (branch chore/gate-hardening-f4, diff against origin/main). You are read-only. Do not trust the dev's claims; read the diff and run nothing destructive.

Spec: .agent/memory/project/specs/backlog-wave-1028/m3-f4-gate-hardening/goldens/spec.md, plus buy-path-live-reads.json, live-reads-behaviour.json, triad-classifier-cases.json in the same goldens directory.

Look for these, citing file:line:
1. F4a AST check (scripts/checks/buy-path-live-reads.mts): a way to drop `live` at app/(nos)/tickets/[slug]/page.tsx:108, :109, :168, in lib/data/ticket-type-lookup.ts, lib/view-models/load-ticket-card.ts or lib/data/admission-availability.ts and still exit 0 (aliased import, wrapper function, spread options, ternary `live: cond`, `live: false`, a second sanityFetch added to a covered file, comments or strings containing `live: true`, template-literal tricks). Does it exit 2 rather than 0 when it finds no calls? Is the allow list narrower than needed?
2. F4a behavioural check (--live-reads): can it pass while a live read is cached (fingerprints that also match the cached ticketsPage query, a fingerprint appearing only on the first request, counting lines from the wrong offset)? Is the ticketsPage positive control real?
3. F4b: does the static-asset probe fail, not skip, when no asset is discovered? Is the walled rule able to pass an `immutable` response? Is `immutable` matched as a whole token? Does the 404 status support leak into other routes (a 500 or 200 for the slug route silently accepted)?
4. F4c: classifier false negatives (URL in a field the linter does not scan, other quoting, uppercase, ports) and false positives (lookalike hosts, email addresses, description text). Confirm the linter still ignores `required`, still returns 2 for a missing file, and that execution/contract.py and execution/codex_qa.sh are unchanged.
5. CI: .github/workflows/ci.yml is valid YAML, the new steps are not continue-on-error, they run after the artefacts they need, and they use no secret that the build job lacks.
6. Any product code changed (proxy.ts, sanity/lib/fetch.ts, app/api/tickets, the ticket page, the three loaders): that is a FAIL.

Respond with PASS or FAIL on line 1, then findings.
