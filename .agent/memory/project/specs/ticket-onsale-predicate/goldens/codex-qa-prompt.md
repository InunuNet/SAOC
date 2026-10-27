You are an adversarial reviewer of a ticketing security fix in the SAOC Next.js repo. Read-only.
Review `git diff origin/main...HEAD`. Do not trust the author's summary. Spec:
.agent/memory/project/specs/ticket-onsale-predicate/goldens/design.md and contract-f1.yaml.

Try to break these, and report each as PASS or FAIL with file:line evidence:
1. Can ANY request reserve or buy a demo product in a production build? Try: slug case variants,
   whitespace, URL-encoding, the reserved slug `demo-general-admission` with demo=false, a demo type
   reached through a capacity-pool sibling, the admin comp route (app/api/admin/tickets/comp), the
   vendor register route, the resume/replay path of an idempotent order, and any second caller of
   `ticketTypeBySlugQuery`. Is the demo check before every other branch in the route's slug loop?
2. Does the 400 refusal for a demo slug differ in status, body or timing class from a nonexistent
   slug? It must not (no fixture-existence oracle).
3. `qaFixturesAllowed`: can NODE_ENV be spoofed by a request? Is the policy read at request time, not
   module load? Is `isTicketingTestMode()` / TICKETING_PAYMENTS_LIVE unchanged? Any new env var?
4. Is `active` and `demo` really selected by every query the predicate relies on? A predicate that
   reads a field the GROQ never selected fails open or closed silently: check both directions.
5. Did any non-demo refusal path change status code or body? Existing 403/409/500 responses must be
   byte-identical for non-demo inputs.
6. Hub/JSON-LD parity: does every displayed hub product have exactly one offer, with Sunset
   Cocktails and the conference products present, siblings collapsed, demo never present, and
   SoldOut following card state? Is the `workshops` card correctly excluded?
7. Does `app/(nos)/national-show/page.tsx` still avoid a transitive firebase-admin import and keep
   `revalidate = 60`? Check the new modules' imports, including `lib/data/ticket-hub-source.ts`.
8. Dead code, orphaned imports, `any`, undocumented type assertions, `console.log` left behind,
   files outside contracts/checks/ticket-onsale-predicate scope-allowlist.
9. Does the offline harness in contracts/checks/ticket-onsale-predicate/_mocks genuinely prevent
   live network and Firestore access? Could a check pass because a stub hid a defect?

End with one line: `VERDICT: PASS` or `VERDICT: FAIL` plus the blocking findings.
