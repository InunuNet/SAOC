# Negative control — evidence gathered against the pre-change tree

All commands run against the already-running dev server on port 3333, on
the unmodified tree (before any dev work on this feature), 2026-08-12.

## Header (isolated, on `/about` — non-home page)

```
$ node contracts/checks/ticket-reachability/extract-header-html.mjs http://localhost:3333/about | grep -o 'href="/tickets"'
(no output)
exit: 1
```
`extract-header-html.mjs` correctly finds `<header>...</header>` (confirmed
separately: `grep -o 'Contact'` on the same extraction returns `Contact`),
and correctly reports no `/tickets` href inside it. TKT-01/TKT-02 are
genuinely red pre-change → capable of red-to-green.

## Mobile menu at 375px (`/about`)

```
$ node contracts/checks/ticket-reachability/check-mobile-tickets-link.mjs http://localhost:3333/about
no a[href="/tickets"] found inside the mobile menu dialog
exit: 1
```
Confirmed the hamburger button is visible at 375px and the dialog opens
(manual run logged the dialog's current link set:
`['About', 'Societies', 'Judging & Awards', 'National Show', 'Events',
'council@saoc.co.za']` — no Tickets entry). TKT-03 is genuinely red
pre-change.

## Home page (`/`)

```
$ curl -s http://localhost:3333/ | grep -o 'href="/tickets"'
(no output)
$ node contracts/checks/ticket-reachability/extract-anchor-text.mjs http://localhost:3333/ /tickets
no <a href="/tickets"> found in http://localhost:3333/
exit: 2
```
TKT-04/TKT-05 are genuinely red pre-change.

## National Show landing page (`/national-show`)

```
$ curl -s http://localhost:3333/national-show | grep -o 'href="/tickets"'
(no output)
$ node contracts/checks/ticket-reachability/extract-anchor-text.mjs http://localhost:3333/national-show /tickets
no <a href="/tickets"> found in http://localhost:3333/national-show
exit: 2
```
TKT-06/TKT-07 are genuinely red pre-change.

## `/tickets` destination (regression guard, already green pre-change)

```
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/tickets
200
$ curl -s http://localhost:3333/tickets | grep -oE '>Adult<|>Child<|>Pensioner<'
>Adult<
>Pensioner<
>Child<
```
TKT-08/TKT-09/TKT-10/TKT-11 are already green on the current tree — they are
**regression guards** (the destination already works; the defect is that
nothing links to it), not change detectors. Labelled as such in the
contract.

## Desktop nav wrap regression (TKT-14) — real red on the current (post-F1) tree

Run against the live tree as it stands after F1's NAV-array change
(`components/chrome/Header.tsx` already has 7 `NAV` entries — confirmed via
`git status`/`grep -n "tickets" components/chrome/Header.tsx` at the time
this assertion was written):

```
$ node contracts/checks/ticket-reachability/check-nav-no-wrap.mjs http://localhost:3333/about "1180,1194,1200,1220,1260,1280"
nav wrap / dead-band failures:
  - width=1180: nav WRAPPED — item tops=[74.171875,74.171875,63.328125,63.328125,74.171875,74.171875,74.171875]
  - width=1194: nav WRAPPED — item tops=[74.171875,74.171875,63.328125,63.328125,74.171875,74.171875,74.171875]
  - width=1200: nav WRAPPED — item tops=[74.171875,74.171875,63.328125,63.328125,74.171875,74.171875,74.171875]
exit: 1
```

Isolating the clean widths confirms the check discriminates correctly, not
just always-red:

```
$ node contracts/checks/ticket-reachability/check-nav-no-wrap.mjs http://localhost:3333/about "1220,1260,1280"
OK: no nav wrap and no dead band across widths [1220, 1260, 1280]
exit: 0
```

TKT-14 is genuinely red at 1180/1194/1200 and genuinely green at
1220/1260/1280 on the same script, same tree — confirms real red-to-green
capability (not a check that's always red or always green regardless of the
actual layout). iPad Pro 11" landscape (1194px) is inside the confirmed-red
band.

## Prior known finding this defect resembles

`/national-show/archive` returned 200 for months with nothing linking to it
(see `app/(marketing)/national-show/page.tsx:69` comment and
`contracts/golden/show-visitor-info/`). Same defect class, different page —
this one guards revenue rather than an archive.
