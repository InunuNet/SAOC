# SEC-03 deployed verification (triad layers 2 and 3)

Run after deploy, against the deployed commit. Probes send only an empty body and are refused before any write.

## browser_deployed_check
Manifest: `.agent/memory/scratch/sec-03-browser-manifest.json` (shape in docs/verification-triad-gate.md). The harness allows one origin, beta.saoc.co.za, with `path_tested` `/events/submit`, `http_status` 200 (the existing "Members only" prompt is a 200), a screenshot of the unauthenticated page, and `commit_sha` equal to HEAD.
Also, by the browser agent or curl, and noted in the BrowserAgent report:
1. Unauthenticated `/events/submit` on beta.saoc.co.za: no form (no `name="kind"` in the HTML).
2. Same on nos.saoc.co.za: no form. A host-correct 404 there is also a pass.
3. `POST /api/events/submit` with no token and with `Bearer not-a-jwt`: 401 on both hosts.
Assertions A15-A18 re-check 1-3 mechanically.

## gws_inbox_check
Absence of an email cannot be proved by the harness: it verifies only that `message_id` exists, with `gws_subcommand` `mail read`. So A21 is declared `required: false`, the same precedent as footer-newsletter-subscribe A23, and exists to satisfy the triad coverage linter. The real check is done by the orchestrator with read-only gws: record the newest message id in the admin inbox, run the refused probes, list again, and confirm no message from the event-submission admin notice appears after the probes. Record both listings in the QA report.
