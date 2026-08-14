# Payment Gateway Integration Effort — Evidence v2 (redo)

Scope: developer integration effort against this repo's stack (Next.js 16 App Router, TS strict,
Node 22, Firebase App Hosting SSR, Firestore; pattern at `app/api/tickets/` — route creates a
checkout → redirect buyer → webhook writes paid ticket).

**Why redone**: the prior pass mislabelled our own fetch failures as vendor doc defects (proven
on Peach and Ozow, below). This pass escalates every claim (plain → `no_cache` → `.md` →
`js=true` → `r.jina.ai` → alt subdomain → GitHub/npm) before calling anything undocumented.
Fetches via Alembic (`curl -s http://localhost:7077/<url>`) plus direct GitHub API/npm registry
(JSON APIs, no bot-wall). Fetch date 2026-08-14.

---

## 1. Ozow — CORRECTED

- **Model**: VERIFIED. Redirect-to-hosted form POST to `https://pay.ozow.com`, 302 to
  `pay.ozow.com/:uuid/Secure`. Source: `www.ozow.com/integrations` (plain fetch, 13,207 chars).
- **SDK**: NOT ESTABLISHED. No official Node/TS npm package (`ozow` → 404). Raw form-POST + hash,
  same shape as this repo's existing `lib/payfast.ts`.
- **Quickstart**: VERIFIED, good — corrects prior "broken" finding. `www.ozow.com/integrations`
  (not the broken `hub.ozow.com` Stoplight reference, a separate secondary resource) is a
  complete 3-step guide: POST with exact fields (`SiteCode`, `Amount`, `TransactionReference`,
  `BankReference`, `CancelUrl`/`ErrorUrl`/`SuccessUrl`/`NotifyUrl`, `IsTest`) → process redirect →
  optional status check via `GET api.ozow.com/GetTransactionByReference`. Corroborated by a
  first-party gist (`gist.github.com/timm-oh/65ea658accd8e923e90a5ccc99b70411`).
- **Webhooks**: VERIFIED — **contradicts prior "undocumented" claim**. Same page, "Hash Check"
  sections: concatenate fields (excl. `HashCheck`) in order → append merchant private key →
  lowercase → **SHA512** → compare to `Hash`. Same construction on outbound POST and inbound
  `NotifyUrl`.
- **Sandbox**: PARTIAL. `IsTest` boolean exists; whether `dash.ozow.com` requires KYC before a
  `SiteCode`/private key issue is NOT ESTABLISHED.
- **Reachability — correction**: `hub.ozow.com` (Stoplight) is dead this session ("Project not
  found" / 403). But it's a secondary reference — the primary doc, linked from
  `ozow.com/integrations`, is on `www.ozow.com` and loads by plain fetch. Scoring Ozow down for
  the broken secondary page while not reading the working primary page is exactly the failure
  this redo corrects.
- **Est. hours (JUDGEMENT)**: 6–10h. Full field list + both-direction hash construction on one
  page; no SDK means hand-rolled SHA512, comparable to PayFast's MD5 already in this repo.

## 2. PayFast

- **Model**: VERIFIED (implemented here). Redirect form POST. Live
  `www.payfast.co.za/eng/process`; sandbox `sandbox.payfast.co.za/eng/process`. `lib/payfast.ts:17-21`.
- **SDK**: NONE. `npm:payfast` is unrelated. Raw form-POST + MD5.
- **Quickstart**: VERIFIED, high — working demo credentials published in-docs
  (`merchant_id=10000100`, `merchant_key=46f0cd694581a`), zero signup needed.
- **Webhooks**: VERIFIED, implemented — ITN, MD5 over ordered params (PHP `urlencode()`), optional
  passphrase, source-IP allowlist. `lib/payfast.ts:38-120`.
- **Sandbox**: VERIFIED SELF-SERVE, no approval gate.
- **Reachability**: `developers.payfast.co.za` fully reachable (plain fetch). `.io` TLD has a TLS
  mismatch — avoid.
- **Est. hours**: 4–8h — working reference implementation already in-repo.

## 3. Yoco

- **Model**: VERIFIED. `POST payments.yoco.com/api/checkouts` → redirect to `redirectUrl`.
  `developer.yoco.com/online/api-reference/checkout/payments/accept-payments/`.
- **SDK**: NONE server-side. `yoco-sdk`, `@yoco/checkout-sdk-web` both 404 on npm. REST-only.
- **Quickstart**: VERIFIED, good — 4-step guide, explicit warning against trusting `successUrl`.
- **Webhooks**: VERIFIED. `yoco.docs.buildwithfern.com/.../verifying-the-events.md`: HMAC-SHA256
  over `webhook-id.webhook-timestamp.rawBody`, base64, header `webhook-signature`;
  `webhook-timestamp` anti-replay (3 min). Ready Node/Express sample.
- **Sandbox**: PARTIAL — `mode: test/live` field implies self-serve test mode, not independently
  re-confirmed this session.
- **Reachability**: Fern-hosted subpages reachable, high confidence.
- **Est. hours**: 6–10h. Clean guide + ready snippet; no SDK keeps it above PayFast.

## 4. Peach Payments — CORRECTED

- **Model**: VERIFIED. Redirect-to-hosted. Live `secure.peachpayments.com/checkout`; sandbox
  `testsecure.peachpayments.com/checkout`.
- **SDK**: PARTIAL. First-party **PHP** SDK only (`packagist.org/peachpayments/checkout-sdk`) +
  frontend JS widget; no Node/TS backend SDK (re-confirmed via npm search this session —
  unofficial React Native / community Medusa plugin only). REST-only for Node.
- **Quickstart**: VERIFIED, corrects prior "blocked" finding — signature page is fully readable
  (below) with a complete worked example.
- **Webhooks: VERIFIED — disproves the prior pass's central claim** ("bot-walled, cannot
  verify"). `curl -s "http://localhost:7077/https://r.jina.ai/https://developer.peachpayments.com/docs/checkout-authentication"`
  returns the full page: HMAC-SHA256 over all payment params (incl. empty), alphabetically
  sorted, concatenated `key+value` with no separators, keyed with the merchant secret token, same
  method reused for webhook/response signing. Full worked example + Python + JS (`crypto-js`)
  samples. `.../docs/checkout-webhooks` (also reachable) adds headers:
  `x-webhook-signature-algorithm`, `x-webhook-timestamp`, `x-webhook-id`, `x-webhook-signature`,
  with replay protection binding signature to webhook ID.
- **Sandbox**: PARTIAL. `dashboard.peachpayments.com` shows a self-serve "Get Started" signup;
  whether test keys issue pre-KYC is NOT ESTABLISHED.
- **Reachability — correction**: prior "Cloudflare-blocked, unreadable" was a tooling limit, not
  a vendor gap — the same URL through `r.jina.ai` returns the full page on first try.
- **Est. hours**: 6–10h (down from prior 10–16h) — quickstart and signature docs are complete,
  just unread previously.

## 5. Paystack

- **Model**: VERIFIED. `POST api.paystack.co/transaction/initialize` → `authorization_url` →
  redirect. `paystack.com/docs/payments/accept-payments/`.
- **SDK**: PARTIAL. `@paystack/inline-js` first-party but frontend-only. Server packages
  (`paystack-node`, `paystack`) are community (orgs `stitchng`, `kehers`). Docs show raw REST.
- **Quickstart**: VERIFIED, good — linear 3-step (Initialize → Complete → Verify).
- **Webhooks**: VERIFIED. `paystack.com/docs/payments/webhooks.md?no_cache=true`: ready Express
  handler, `x-paystack-signature` = HMAC SHA512 of payload with secret key, Node `crypto` sample.
  Retry: live every 3min×4 then hourly/72h; test hourly/72h.
- **Sandbox**: VERIFIED SELF-SERVE — corrects prior "inferred" status.
  `paystack.com/docs/payments/test-payments/?no_cache=true` publishes working test cards
  (success/fail/refund/API-error) and test bank/mobile-money accounts, no live approval needed.
- **Reachability**: Cloudflare bot-check blocks plain/`.md` fetch on many pages; `?no_cache=true`
  reliably bypasses (reconfirmed this session). Costs more attempts, nothing genuinely missing.
- **Est. hours**: 6–10h. Community-only SDK + bot-wall friction are the only frictions.

## 6. Flutterwave

- **Model**: VERIFIED. Redirect/hosted checkout default; full API for custom flows.
- **SDK**: VERIFIED, first-party. `flutterwave-node-v3` (npm), `Flutterwave/Node-v3` (GitHub
  official org); `flutterwave-react-v3` for frontend.
- **Quickstart**: VERIFIED, good. `developer.flutterwave.com`.
- **Webhooks**: VERIFIED. HMAC-SHA256 over merchant secret hash, header
  `verif-hash`/`flutterwave-signature`. `developer.flutterwave.com/docs/webhooks`.
- **Sandbox**: VERIFIED SELF-SERVE — test keys issue immediately at signup.
- **Reachability**: high, plain fetch throughout.
- **Est. hours**: 4–8h — fastest path with an official SDK + instant test keys. **Caveat**
  (from `flutterwave-writeup.md`, contract research, not integration): SAOC as NGO/Charity sits in
  Flutterwave's pre-approval merchant category, and the `/za/` merchant agreement is
  Nigeria-governed, not SA-governed — a commercial/legal flag, not an integration-effort one.

## 7. Stitch

- **Model**: VERIFIED. Hosted/redirect checkout via Stitch Express (+ cart plugins) or
  REST/GraphQL API.
- **SDK**: VERIFIED, first-party. `@stitch-money/node` (npm, v1.4.0 at research time).
- **Quickstart**: VERIFIED, good — `docs.stitch.money/sandbox` is a documented self-serve path.
- **Webhooks**: VERIFIED. Delivered via Svix, documented HMAC-SHA256
  (`docs.stitch.money/webhooks/using_webhooks` + legacy variant), official Svix Node/Express
  example.
- **Sandbox**: VERIFIED SELF-SERVE, explicitly documented, no live approval required.
- **Reachability**: high, plain fetch throughout (14 fetches, no blocks in prior research).
- **Est. hours**: 4–8h — alongside PayFast/Flutterwave as fastest of the ten. **Caveat**: 6-month
  dormancy auto-suspend (relevant to the ~36-month show cycle, not integration effort).

## 8. iKhokha (iK Pay API)

- **Model**: VERIFIED. `POST api.ikhokha.com/public-api/v1/api/payment` creates a Paylink,
  redirect to `paylinkUrl` — confirmed against iKhokha's own first-party example repo, not just
  marketing copy. **iK Pay Gateway** (WooCommerce/Wix/Shopstar plugins) is a separate product
  from **iK Pay API** (this one) — different rates, different docs, do not conflate.
- **SDK**: PARTIAL. No npm package (`ikhokha` search: none first-party, only unofficial
  `elmmac/ikhokha` PHP). First-party official example repo,
  `github.com/ikhokha/ik-pay-api-examples` (verified via GitHub API: org `ikhokha`, org ID
  53579573), with a working Node example (`nodejs/index.js`, `nodejs/pay-api-app/`) — starter
  code, not an installable package.
- **Quickstart**: PARTIAL. `developer.ikhokha.com` is a client-rendered SPA — plain fetch, `.md`,
  and `js=true`+scroll+grace all returned only the empty CRA shell — genuinely not retrieved by
  us. The GitHub example repo (readable via `raw.githubusercontent.com`) fills the gap with a
  complete runnable request-signing example.
- **Webhooks: VERIFIED for outbound signing; genuinely incomplete for inbound verification — read
  directly from iKhokha's own repo, not a fetch failure.** Outbound: HMAC-SHA256 over
  `<URL path>+<JSON body>` with the Application Key, header `IK-SIGN` + `IK-APPID`
  (`nodejs/index.js`). The same repo's webhook handler
  (`nodejs/pay-api-app/backend/index.js`, `app.post("/payment/webhook/callback", ...)`) **logs the
  payload and returns 200 without verifying any signature** — iKhokha's own official example does
  not demonstrate inbound webhook verification.
- **Sandbox**: NOT ESTABLISHED. FICA approval required before transacting per `help.ikhokha.com`;
  whether keys work pre-FICA against a test endpoint is unconfirmed.
- **Reachability**: `developer.ikhokha.com` genuinely unreachable by any route tried (pure
  client-rendered SPA, content likely behind an authenticated API). GitHub repo is the working
  substitute and was fully read.
- **Est. hours**: 10–16h. Wide range — primary docs unreadable, and inbound webhook verification
  would need reverse-engineering or vendor support rather than a documented pattern.

## 9. Zapper

- **Model**: VERIFIED. eCommerce Gateway: hosted checkout via 5 cart plugins, or Zapper's
  client-side JS Payment Widget (`new zapper.payments.PaymentWidget(...)`), plus REST API
  (`api.zapper.com/business/api/v1/...`: Auth, Invoices, Payments, Refunds, Notifications).
  `zapper.gitbook.io/integrations` (fully reachable, `.md` and `llms.txt` both work).
- **SDK**: NOT ESTABLISHED. npm search "zapper payment" → only an unofficial QR-widget lib and
  Zapper's internal ESLint-rules package. Direct REST calls needed.
- **Quickstart**: PARTIAL — reference-style GitBook docs, no single linear walkthrough found.
- **Webhooks: genuinely undocumented — confirmed with positive evidence, not a failed fetch.**
  Full `llms.txt` index read; the one webhook page and both versioned payload-model pages (1.2.0,
  1.3.0) plus the deprecated legacy model all fetched successfully (high confidence, no
  bot-wall). The 1.3.0 spec is a complete field table with a worked JSON example — **and contains
  no signature, HMAC, secret, or auth header anywhere**. Only protection: the notify URL is
  configured per-merchant via a support request — obscurity, not signing. This is the one
  provider here where "undocumented" is a documentation fact, not a retrieval gap.
- **Sandbox**: NOT ESTABLISHED — no self-serve test environment page found.
- **Reachability**: high — every needed page read via plain fetch/`.md`, no bot-wall.
- **Est. hours**: 12–18h. No SDK, no linear quickstart, and no way to cryptographically verify a
  webhook — a real integration would need a synchronous status-check fallback after every
  webhook, or vendor confirmation that a verification mechanism exists off-docs.

## 10. PayGenius

- **Model**: VERIFIED. Hosted Payment Pages — POST transaction details, get a redirect URL
  ("Redirect Payments") or embed it in an invoice ("Email Pay"). Two environments: Production
  (`www.paygenius.co.za`), Development (`developer.paygenius.co.za`), same shape, separate
  creds. `developer.paygenius.co.za/docs` (via `r.jina.ai` — plain fetch returned only a thin
  shell).
- **SDK**: NOT ESTABLISHED — npm search "paygenius" returns zero packages this session. Plain
  REST, hand-rolled signing.
- **Quickstart**: VERIFIED, adequate. `developer.paygenius.co.za/docs/reference.html` (via
  `r.jina.ai`, ~99KB extracted) documents required headers (`Content-Type`, `Accept`, `X-Token`,
  `X-Signature`), full signing steps, transaction object, refund endpoints, status/card
  constants — a complete reference, not a landing page.
- **Webhooks: VERIFIED — corrects prior "NOT ESTABLISHED".** Same page, "Success/Failed/Pending
  Payment Webhook (Notify URL)": merchant sets `urls->notify`; PayGenius POSTs JSON (`success`,
  `amount`, `currency`, `paymentReference`, `merchantReference`, `status`, `date`, `hash`) on
  success (opt-in for failed/pending/refunded). Verification quoted directly: **`hash` =
  MD5(paymentReference + merchantSecret)**. Retries on non-`20X`, up to 20× or 3 days. Separate,
  stronger scheme for *outbound* API requests: HMAC-SHA256 over `<URI>` (GET) or
  `<URI>\n<body>` (POST), header `X-Signature` — two distinct signing schemes, both documented on
  one page.
- **Sandbox**: PARTIAL. Development environment exists with its own token/key pair; whether a
  token issues pre-approval is unconfirmed — the standalone signup URL
  (`info.paygenius.co.za/copy-of-sign-up`) 404s, and a parallel "Book a free demo" CTA suggests a
  sales-assisted path may run alongside self-serve.
- **Reachability**: plain fetch of `/docs` and `/docs/reference.html` returned thin content;
  `r.jina.ai` retrieved both in full. Reachable once the right route was used, not a vendor gap.
- **Est. hours**: 6–10h. Full reference with both signing schemes spelled out; only friction is
  no SDK and the unresolved sandbox-approval question.

---

## Fetch budget

~45 Alembic/web fetches this session (Ozow ~9, Peach ~4, Paystack ~1, iKhokha ~2 Alembic + 6
GitHub API calls, Zapper ~3, PayGenius ~4, plus npm/GitHub lookups), reusing already-verified
PayFast/Yoco/Flutterwave/Stitch facts from prior-session research not in dispute. Within the
60-fetch cap.
