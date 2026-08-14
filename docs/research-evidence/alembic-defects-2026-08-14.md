# Alembic defect report — 2026-08-14

Found while proving reachability of merchant contracts, pricing, technical docs, support centres
and NPO pages across five South African payment gateways (Ozow, PayFast, Yoco, Peach, Paystack).
Roughly 130 fetches across six agents.

**Alembic version tested: v1.68.0** (from `curl -s http://localhost:7077/`).

---

## D1 — `llms.txt:excerpt` returns nav/sitemap content at HIGH confidence · SEVERITY: HIGH

The dangerous one. Requesting a specific article/leaf URL returns the site's **navigation menu or
sitemap** as the body, reported with `X-Alembic-Confidence: high` and no reason codes. It is
byte-indistinguishable from a correct fetch, so an agent has no signal that it read the wrong thing.

Reproduced independently on two unrelated sites:
- `https://support.yoco.help/<article>` — confirmed on 3 separate articles. In one case it returned a
  *different article* entirely.
- `https://www.peachpayments.com/fees/` — returns a sitemap-style page list, no fee table.

**Why the confidence layer misses it:** per `docs/confidence-signaling.md`, no reason code fires on a
well-formed nav menu. It is not an error page (`error_page_pattern`), not thin (`below_token_floor`),
not an og stub, and its quality score is respectable — nav menus are clean, well-structured markup.
The layer is explicitly designed to catch "output that looks clean but isn't trustworthy", and this is
exactly that case slipping through.

**Suggested fix:** when the requested URL is a leaf/article path, verify the extracted `<h1>`/title
plausibly corresponds to the requested slug before returning `high`. On mismatch, emit a new soft
reason code (e.g. `slug_title_mismatch` → `medium`). Alternatively prefer `content-negotiation` over
`llms.txt:excerpt` when both are available for a leaf URL.

**Known workaround:** appending `.md` to the URL forces `content-negotiation` and returns the correct
article. Confirmed working on both `support.yoco.help` and `developer.yoco.com` (Fern-hosted; its
llms.txt indexes 118 pages correctly).

---

## D2 — `adapter:stoplight` does not fire on Stoplight-hosted docs · SEVERITY: HIGH

`docs/API.md` documents `adapter:stoplight` (quality 90) for Stoplight SPA docs via the platform's
JSON API. It did not engage:

```
$ curl -si "http://localhost:7077/https://hub.ozow.com/docs/ozow-api"
X-Alembic-Strategy: og-description
X-Alembic-Original-Tokens: 484363
X-Alembic-Clean-Tokens: 12
X-Alembic-Yield-Pct: 0.0%
```

484,363 tokens in, 12 out, on the exact platform the adapter targets. Two consequences: the SPA shell
is returned instead of content, and downstream work has to hand-roll the Stoplight JSON API
(`https://hub.ozow.com/api/v1/projects/<id>/nodes/<slug>`, markdown in the `data` field), which does
work and yielded a 34,265-word document. Worth checking whether the adapter's URL-pattern match covers
`hub.<host>` / `/docs/<slug>` shapes.

Related: the raw OpenAPI reference nodes in that project return upstream 500s from Stoplight itself —
that one is not Alembic's fault, noted only so it isn't conflated.

---

## D3 — Cloudflare challenge is retryable but presents as content · SEVERITY: MEDIUM

`https://paystack.com/za/pricing` sits behind Cloudflare Bot Management (`cf-mitigated: challenge`,
`server: cloudflare`). The challenge interstitial is extracted and returned as ordinary body text
beginning "Performing security verification" — agents recorded that as the page's content.

It is **intermittent, not absolute**: `?no_cache=true` with `Accept: application/json` retrieved the
real pricing page on a later attempt. That means a cached failure can masquerade as a live block, and
an agent that retries without `no_cache=true` will keep re-reading the stored challenge page.

**Suggested fix:** detect `cf-mitigated: challenge` / the "Performing security verification" body and
(a) never cache that response, (b) force `low` confidence with a dedicated reason code such as
`bot_challenge_page`.

---

## D4 — `pdf-text` returns `pdf-unsupported` on a valid, small, text-based PDF · SEVERITY: HIGH

**This entry was wrong twice before reaching its current form. Both errors are recorded because the
sequence matters more than the conclusion.**

First we reported "Alembic cannot read PDFs" — taken from the stale skill file (see the last section),
never tested. Then, having read `docs/API.md`, we reported the opposite: that `pdf-text` works and any
failure means the file is encrypted, scanned or oversized. That was also asserted from documentation
rather than from a test. Only the third pass actually ran one.

**Measured, 2026-08-14, Alembic v1.68.0:**

```
$ curl -si "http://localhost:7077/https://yoco.com/merchant-agreement.pdf?no_cache=true"
X-Alembic-Strategy: pdf-unsupported
X-Alembic-Clean-Tokens: 65
X-Alembic-Confidence: low
X-Alembic-Confidence-Reasons: low_quality_score
```

The file itself:
- **226,647 bytes (0.21 MB)** — far inside the documented 5 MB ceiling
- Header `%PDF-1.3`, `content-type: application/pdf`, HTTP 200 after one 301
- **Text-based, not scanned** — proven by r.jina.ai extracting all 14 pages of text from this exact
  file, complete to its final clause (20.5)

All three documented causes of `pdf-unsupported` — encrypted, scanned, oversized — are therefore ruled
out. Either `pdf-text` is not being reached for this file, or pypdf is failing on it and the failure is
being reported as an unsupported-format condition.

Across roughly 130 fetches in this session, spanning several PDF URLs on multiple hosts, **the
`pdf-text` strategy was never observed firing successfully even once.** We cannot say it is broken in
general; we can say it did not work on any PDF we needed, including this one, which meets every stated
precondition.

Secondary points, both still worth acting on:
1. `pdf-unsupported` does not say **which** condition applied. Given the above, it appears to be
   returned for at least one case that is none of the three. Distinguishing them — and having a
   separate code for "extraction attempted and failed" — would have saved this project three rounds.
2. `?js=true` on a PDF URL returns `502 — "Page.goto: Download is starting"`. Sanitised and documented,
   but falling through to `pdf-text` would be more useful than erroring.

**Field note:** proxying r.jina.ai *through* Alembic reads every PDF that returned `pdf-unsupported`:
```
curl -s "http://localhost:7077/https://r.jina.ai/<pdf-url>"
```
Verified complete (not truncated) on Yoco's 14-page Merchant Agreement, Yoco's 6-page Payment Services
T&Cs, and Peach's 35-page MSA, across two hosts. It also resolved a PDF embedded in a JS viewer without
the href being scraped first. Offered as evidence that these files are text-based and within reach —
not as a proposed dependency.

---

## D4b — link extraction only follows `<a href>`, missing JS-embedded documents · SEVERITY: MEDIUM

`https://www.peachpayments.com/legal-doc/merchant-service-agreement/` serves its 35-page merchant
agreement through a JavaScript document-viewer widget rather than an anchor tag. Checked three ways:
plain fetch (0 of 20 extracted links were PDFs), `?js=true` with `X-Alembic-Scroll` and an extended
grace period (Playwright-rendered, still 0 PDF links), and guessed HubSpot CDN paths (all 404).

The JSON response's `links[]` array genuinely contains nothing to follow, so an agent working from the
landing page concludes — reasonably but wrongly — that no contract is published. The document exists and
is retrievable; only the discovery path fails. Extracting URLs from `<embed>`, `<object>`, `<iframe>`
and common viewer-widget data attributes would close this.

---

## D4c — Camoufox documented but not enabled; effectiveness unmeasured · SEVERITY: LOW

`POST /render_firefox` with the exact payload from
`docs/F1-Camoufox-Stage-4-5-stealth-firefox-engine.md` returns **405 Method Not Allowed, Allow: GET** —
`ALEMBIC_CAMOUFOX=1` was not set when this instance started. So the stealth engine was never actually
exercised against Cloudflare (D3), and nothing here should be read as evidence either way.

Separately, that document's QA section is headed "Testing and Quality Assurance (**Simulated
Results**)", with resource usage and stability marked PENDING and Cloudflare/Akamai/Datadome evasion
recorded as a "PARTIAL PASS". A reader can easily take it for a measured capability. Marking simulated
results as such in the summary — or gating the doc until real measurements exist — would prevent that.

---

## D5 — Title extraction on Freshdesk-style portals · SEVERITY: LOW

Every knowledge-base article on `https://support.payfast.help` returns correct, complete body content
but a **title of generic portal chrome** rather than the article's own heading — at
`confidence: high`. Body is trustworthy, title is not. Mild on its own, but it defeats any
title-versus-slug check used to detect D1, so the two interact.

---

## D6 — Inconsistent JS capture within a single site · SEVERITY: LOW

Accordion/FAQ content renders on some pages and not others on the same host:
- `payfast.io/faq/merchant-faqs/` — accordion Q&A captured correctly.
- `payfast.io/fees/` — the fee table extracts, but the trailing FAQ accordion returns headings with no
  answers.

Same pattern on `support.payfast.help`: index page fine, one category sub-page near-empty.

---

## D7 — TLS certificate mismatch surfaced as a generic 502 · SEVERITY: LOW

`https://developers.payfast.io` fails with a cert-mismatch error reported as a 502. Naming TLS
validation as the cause in the error message would save a caller from assuming the host is down.
(The working docs host is `developers.payfast.co.za`.)

---

## Not defects — recorded so they aren't re-filed

- `?js=true` returning 502 on unreachable render service: documented, sanitised, correct.
- `?q=` returning 503 without a search backend: documented.
- Ozow's OpenAPI reference nodes 500ing: upstream Stoplight fault.
- Peach's merchant contract missing from the HTML page: verified via the JSON `links[]` array that no
  PDF/iframe link exists on the page. Not an extraction miss — the site genuinely doesn't link it.
  (The PDF was reachable by another route.)

---

## Separate issue — the skill file, not the proxy

`~/.claude/skills/Alembic/SKILL.md` documents **v1.0** and describes the interface as "prepend the URL
— that's the entire interface", with a five-stage pipeline. Live is **v1.68.0**. Absent from the skill:
PDF extraction, platform adapters, hydration-state extraction, the confidence-signalling headers,
Camoufox stealth Firefox (stage 4.5), `POST /batch`, and every query parameter and `X-Alembic-*` request
header.

This is the root cause of most of the misuse in this session — agents did not know `no_cache`,
`X-Alembic-Wait-For`, `X-Alembic-Scroll`, `X-Alembic-Grace-Ms` or `Accept: application/json` existed,
and one incorrect defect (D4) was filed off the stale documentation. Updating the skill is likely
higher-value than any single fix above.

Out of scope for this project to edit (lives outside the repo) — flagged for the Alembic workstream.
