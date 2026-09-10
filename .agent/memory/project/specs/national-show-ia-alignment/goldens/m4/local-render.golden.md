# Golden — local render proof: every page renders on localhost before anything is pushed

**Brad's process rule, 2026-09-10:** every page must render correctly on `localhost:3000`
before anything is pushed. **Build a verification step that proves local render, not just that
a file exists.**

That is the whole point of this golden. `test -f page.tsx` proves a file exists. It does not
prove the route resolves, that the data helper does not throw, that the page is not a
client-side error boundary returning 200, or that the four deleted slugs are actually gone.
M4 creates six pages and deletes one route; a file-existence check would have gone green on
every one of them while the site was broken.

---

## The driver

`scripts/checks/verify-nos-m4-local-render.ts` → `.tmp/sandbox/nos-ia/m4-local-results.txt`.

Exit **0** all passed · **1** a check failed · **2** the harness itself broke, never collapsed
into 1. Every id is written on every run, PASS or FAIL, and an unwritten id is exit 2 — a check
that silently fails to emit must not be indistinguishable from a check that passed.

Manifest lines are two colon-free tokens (`L3 PASS`) so each assertion is an unquoted grep.

**Server:** probe `http://localhost:3000` first and reuse it if it answers; otherwise start a
dev server on a free port and stop it at the end. The manifest records `SERVER reused` or
`SERVER started <port>` so a green run cannot hide the fact that it tested nothing. It lives
in `scripts/checks/`, never `execution/` — that tree is HARNESS-owned and the next
`make update-template` deletes it, taking the gate with it.

## Check ids

| id | check |
|---|---|
| `L1` | all **17 listed routes** from `content/national-show-routes.json` return HTTP **200** |
| `L2` | each renders an `<h1>` whose normalized text is non-empty and equals the route's manifest `label` or its seed `title`. **This is what separates a rendered page from an error boundary** — a Next error boundary returns 200 with no page `<h1>` |
| `L3` | none of the 17 responses contains an error-overlay marker: `nextjs-portal`, `__next_error__`, `Application error`, `Unhandled Runtime Error`, `Internal Server Error` |
| `L4` | **zero** `console.error` and zero `pageerror` events across the 17 loads, collected in a real browser context, not from the HTML |
| `L5` | `/national-show/upcoming` returns **404**. A **3xx fails** — the ruling was "delete the route, no redirect", and a 308 left in place satisfies "the page is gone" while leaving exactly the artefact the ruling removes |
| `L6` | `/national-show/plant-exhibition`, `/national-show/plant-sales`, `/national-show/judging-and-awards` and `/national-show/contact` each return **404**. A 200 here means someone built a page the ruling forbade |
| `L7` | every one of the 17 renders its `ShowSectionNav`, and every internal `href` on each of the 17 pages resolves to a route that returns non-404. **Crawled, not read from source** — a link that renders is a link a visitor can click, and a source-level check misses a href built at runtime |
| `L8` | the four unlisted sub-routes (`vendors/apply`, `vendors/register`, `vendors/payment`, `archive/[year]` at a real year) return a non-5xx status. They are the other lane's and may legitimately 403 or redirect when ungated; a **500 is ours to notice**, because M4's manifest and sitemap changes can break them |

`L4` and `L7` are the two that catch the failures a 200-only check cannot see: a page that
renders but throws in the browser, and a page that renders but links into a hole.

## Why this is not the deployed browser check

They prove different things and neither substitutes for the other.

| | this (`L1`–`L8`) | `browser_deployed_check` (`D31`) |
|---|---|---|
| origin | `localhost` | the live deployed origin |
| runs | **before push**, every gate run | after deploy |
| catches | a route that does not resolve, a helper that throws, a dead link, a deleted route that is not deleted | a build that succeeded locally and failed on the host; env/secret gaps; the real thing a visitor sees |

Brad's rule is that the first column runs *first*. A deployed check that fails has already
cost a push.

## What this does not prove

- **That the page looks right.** `L1`–`L8` prove it resolves, renders its own heading, throws
  nothing and links nowhere dead. Nothing here measures layout — that is the notice verifier
  (`N1`–`N15`), the grid check (`G3b`), and Codi's eye.
- **That the content is correct.** The linkage and provenance checks do that.
- **That the deployed build matches.** `D31`.
