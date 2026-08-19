# Negative control — evidence gathered against the pre-change tree

All commands run against the local dev server on port 3333, on the
unmodified tree (before any dev work on this feature), 2026-08-19.

## Footer legal links

```
$ node contracts/checks/policy-pages/check-footer-legal-links.mjs http://localhost:3333 http://localhost:3333/about
OK: footer -> /privacy ("Privacy") -> HTTP 200
FAIL: footer has no <a href="/terms">
FAIL: footer has no <a href="/refunds">
exit: 1
```
Confirms the audit: `/privacy` is linked, `/terms` and `/refunds` are not.
POLICY-01..03 are genuinely red pre-change.

## Legal-draft notice

```
$ node contracts/checks/policy-pages/check-legal-draft-notice.mjs http://localhost:3333/privacy
FAIL: no legal-draft notice text found on http://localhost:3333/privacy
exit: 1
```
(Same result for `/terms`; `/refunds` 404s entirely.) POLICY-04..06 are
genuinely red pre-change.

## Privacy content

```
$ node contracts/checks/policy-pages/check-privacy-content.mjs http://localhost:3333/privacy
FAIL: the false "not shared with third parties" claim is still present
FAIL: missing required disclosure — payment gateway disclosure
FAIL: missing required disclosure — Resend (email provider) disclosure
FAIL: missing required disclosure — Firebase/Google infrastructure disclosure
FAIL: missing required disclosure — Information Officer
FAIL: missing required disclosure — retention period language
FAIL: missing required disclosure — Information Regulator complaint route
exit: 1
```
POLICY-07 is genuinely red pre-change (both halves: false claim present,
required disclosures absent).

## Terms ticket conditions

```
$ node contracts/checks/policy-pages/check-terms-ticket-conditions.mjs http://localhost:3333/terms
FAIL: missing the 18+ restriction statement tied to Sunset Cocktails
FAIL: missing limited-capacity statement for workshops/field trips
FAIL: no identifiable conditions-of-sale / ticket-terms section
exit: 1
```
POLICY-08 is genuinely red pre-change.

## Refunds page

```
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/refunds
404
$ node contracts/checks/policy-pages/check-refunds-no-fabrication.mjs http://localhost:3333/refunds
FAIL: http://localhost:3333/refunds did not return HTTP 200 (got 404)
exit: 1
```
POLICY-09/POLICY-10 are genuinely red pre-change — the page doesn't exist.

## Script sanity (positive control, not part of the contract)

Each of the five scripts above was also run against a synthetic page
containing a plausible correct implementation of every required fact, and
passed (exit 0) in every case; `check-refunds-no-fabrication.mjs` was
additionally run against a synthetic page containing fabricated figures
("14 days", "50%") and correctly failed. This rules out a script that can
never go green, and rules out a fabrication guard that never fires.
