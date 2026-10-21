Adversarially review the working-tree diff (git diff HEAD plus untracked files) for mission footer-newsletter-subscribe.
Spec: .agent/memory/project/specs/footer-newsletter-subscribe/goldens/README.md and copy.md. Single opt-in is a final decision; do not
flag the absence of double opt-in or of a welcome email. Hunt for: subscriber enumeration via status, body, headers or timing;
unsubscribe state change on GET; guessable or logged tokens; PII (raw email) in logs; CSV/formula injection in the export; admin export
or list reachable without lib/admin-auth.ts passing (fail-open on any session reason); Firestore undefined writes; a repeat subscribe
creating a duplicate doc or clobbering an unsubscribed doc incorrectly; rate-limit bypass or write-before-limit ordering; client bundle
importing firebase-admin; footer visual or a11y regressions versus r20; invented user-facing copy beyond goldens/copy.md.
First line of output must be PASS or FAIL, then findings.
