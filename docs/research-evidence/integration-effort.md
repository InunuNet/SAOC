# Payment Gateway Integration Effort — Evidence

Scope: developer integration effort only, against this repo's stack (Next.js 16 App Router, TS
strict, Node 22, Firebase App Hosting SSR, Firestore; existing pattern at `app/api/tickets/` —
API route creates a checkout → redirect buyer → webhook writes paid ticket; PayFast sandbox
already implemented in `lib/payfast.ts`). No scoring, no ranking. All fetches via Alembic
(`curl -s http://localhost:7077/<url>`). Fetch date 2026-08-14 unless noted otherwise.

---

## 1. Ozow

- **Integration model**: VERIFIED. Redirect-to-hosted. Signed server-to-server POST, customer
  redirected to Ozow's gateway. `hub.ozow.com/.../nodes/uzyd4lt3aabcd-pay-by-bank`: *"The
  merchant sends a secure POST request... the customer is then redirected to the Ozow payment
  gateway."*
- **Official SDK**: NOT ESTABLISHED. `registry.npmjs.org/ozow/latest` → `"Not Found"`. No
  official Node/TS package found. Raw signed-POST + hash, same shape as PayFast's existing
  `lib/payfast.ts`.
- **Quickstart quality**: PARTIAL. Product-overview articles (Pay by Bank, Bank APIs) are
  readable, but the API/parameter reference nodes — field names, hash algorithm,
  request/response schemas — return **upstream HTTP 500** from Stoplight, confirmed on
  `9ob8krs7bvs82-pay-in`, `kzyq6pohphnbw-post-from-merchant-website`, and `getting-started`.
  Verbatim: `{"message": "An unknown error occurred... see status.stoplight.io", "code": 500}`.
  Not an Alembic defect — the error body is passed through correctly from Ozow's own doc host.
- **Webhooks**: PARTIAL. Existence documented (*"If the merchant supplies a notification
  webhook in their initial POST, the merchant receives a response... with the details of the
  completed, cancelled, or expired transaction"*), but signature verification is undocumented
  publicly — it lives in the same 500-ing reference pages.
- **Sandbox**: NOT ESTABLISHED. No self-serve test-credential page found; the getting-started
  reference node 500s. Cannot confirm whether sandbox access needs an approved merchant account.
- **Docs reachability**: CONFIRMED BROKEN for the endpoint reference — overview articles and
  `ozow.com/faq` work, but the OpenAPI layer a developer needs to write code against 500s
  upstream. Direct hit to integration time.
- **Recurring API**: NOT ESTABLISHED — inside the broken reference set.
- **Estimated effort (JUDGEMENT)**: 12–20+ hours, wide range because the endpoint reference is
  currently unusable — a developer would have to reverse-engineer field/hash format from a
  Postman collection or support instead of reading it.

---

## 2. PayFast

- **Integration model**: VERIFIED (already implemented here). Redirect-to-hosted form POST.
  Live `https://www.payfast.co.za/eng/process`; Sandbox
  `https://sandbox.payfast.co.za/eng/process`. Source: `lib/payfast.ts:17-21`,
  `developers.payfast.co.za/docs` (31,978 chars, confidence high).
- **Official SDK**: NONE. `registry.npmjs.org/payfast/latest` is an unrelated community React
  Native package. Integration is raw form-POST + MD5 signature — exactly what `lib/payfast.ts`
  already hand-implements.
- **Quickstart quality**: VERIFIED, high. Docs give a copy-pasteable `<form>` example with
  **published working demo credentials embedded in the page** (`merchant_id="10000100"`,
  `merchant_key="46f0cd694581a"`) — a developer can fire a real sandbox transaction with zero
  signup.
- **Webhooks**: VERIFIED and already implemented — ITN flow, MD5 signature over an ordered
  param string (PHP `urlencode()` semantics, optional passphrase), source-IP allowlist, all in
  `lib/payfast.ts:38-120` / `app/api/tickets/itn` against
  `contracts/golden/payfast-m1/payfast-hosts.golden.json`. No built-in local-webhook simulator
  found; documented pattern is a publicly reachable dev URL.
- **Sandbox**: VERIFIED SELF-SERVE, no approval gate — the demo credentials above work with no
  signup; a full personal sandbox account is also self-serve per the docs' own wording.
- **Docs reachability**: `developers.payfast.co.za` fully reachable (high confidence,
  4,128+ words). Per prior sweep (`.agent/memory/scratch/reach/payfast.md`),
  `developers.payfast.io` (the `.io` domain) has a TLS cert mismatch and 502s — avoid linking
  developers there.
- **Recurring API**: mentioned in the fetched docs and confirmed present in the wider KB
  (subscription-management articles, per prior sweep) — REACHABLE, not read in full this
  session.
- **Estimated effort (JUDGEMENT)**: 4–8 hours to a working, webhook-verified test payment —
  this project already has a working reference implementation in-repo, which is itself evidence
  for this estimate.

---

## 3. Yoco

- **Integration model**: VERIFIED. Redirect-to-hosted checkout. Server-side
  `POST https://payments.yoco.com/api/checkouts`, then redirect to the response's
  `redirectUrl`. Source: `developer.yoco.com/online/api-reference/checkout/payments/accept-payments/`
  (prior session, `.agent/memory/scratch/reach/yoco.md`).
- **Official SDK**: NONE for server-side/Node. `registry.npmjs.org/yoco-sdk/latest` →
  `"Not Found"`; `@yoco/checkout-sdk-web` → `"error": "Not found"`. Yoco's "Payment SDK" is a
  native iOS/Android card-machine SDK gated behind a partner-application form (*"integration is
  only available to a limited number of partners"*) — irrelevant to this web flow. All Checkout
  API examples are plain `fetch`/`requests`/`Net::HTTP` — REST-only.
- **Quickstart quality**: VERIFIED, good. 4 explicit steps (register webhook → create checkout
  → redirect customer → verify payment success), with an explicit warning: *"Do not use
  `successUrl`... Always use webhooks for confirmation."*
- **Webhooks**: VERIFIED, detailed, including signature verification.
  `yoco.docs.buildwithfern.com/guides/online-payments/webhooks/verifying-the-events.md`:
  HMAC-SHA256 over `webhook-id.webhook-timestamp.rawBody`, base64-encoded, compared to the
  `webhook-signature` header; `webhook-timestamp` used against replay (3-min threshold
  recommended). Ready Node.js/Express and Python code samples given. A dedicated "Testing"
  webhooks doc page exists in the index but was not opened this session.
- **Sandbox**: PARTIAL — a `mode: test`/`live` field on webhook subscriptions implies self-serve
  test mode, but no explicit signup/test-key page was independently fetched this session.
- **Docs reachability**: hub landing (`developer.yoco.com`) is thin, but underlying pages on
  `yoco.docs.buildwithfern.com` (Fern-hosted) are reachable at high confidence for every
  specific page fetched.
- **Recurring API**: NOT ESTABLISHED — not encountered this session.
- **Estimated effort (JUDGEMENT)**: 6–10 hours. Clean 4-step guide and a ready Node.js
  webhook-verification snippet lower it; total absence of a server SDK (hand-rolled REST/HMAC,
  comparable to PayFast) keeps it above PayFast's estimate.

---

## 4. Peach Payments

- **Integration model**: VERIFIED. Redirect-to-hosted checkout (also an Embedded Checkout
  widget option, not needed here). Live `https://secure.peachpayments.com/checkout`; Sandbox
  `https://testsecure.peachpayments.com/checkout`
  (`developer.peachpayments.com/docs/checkout-hosted.md`).
- **Official SDK**: PARTIAL. A first-party **PHP SDK** is linked
  (`packagist.org/packages/peachpayments/checkout-sdk`) plus a first-party Embedded Checkout JS
  SDK — but that's a *frontend* widget SDK, not backend. No Node/server SDK found anywhere in
  the docs index (`llms.txt` filtered for "sdk"/"node" — only PHP SDK, Mobile SDK, Embedded
  Checkout frontend SDK). A linked sample project for redirect-based checkout is Python, not
  Node, reinforcing REST-only backend integration.
- **Quickstart quality**: PARTIAL. The Hosted Checkout page is mostly cards linking to an API
  playground, Postman collection, PHP SDK, and sample projects rather than an inline
  request/response walkthrough. The page that documents the required HMAC-SHA256 signature
  (`checkout-authentication.md`) was **blocked by a Cloudflare bot challenge** both in the prior
  sweep and again this session (*"Hello there, human! We need you to prove you're not a
  robot."*) — could not be read either time.
- **Webhooks**: PARTIAL. Behaviour is documented: webhook fires on every DB/PA/RF state change
  (`created → pending → successful/uncertain/cancelled`), signed with HMAC-SHA256 "using the
  secret token as the key," sent from a known IP range
  (`developer.peachpayments.com/docs/checkout-webhooks.md`). The exact signature-generation
  steps live on the same bot-walled `checkout-authentication` page, so only the algorithm name
  is confirmed, not the worked steps. A changelog entry, *"Self-service webhook signing for
  Checkout and Payment Links"* (2026-07-21), was found but not read in full.
- **Sandbox**: NOT ESTABLISHED this session. The on-disk merchant contract is titled
  *"Peach-MSA-Automated-Onboarding..."* (`.agent/memory/scratch/reach/gaps.md`, prior session),
  suggesting some self-serve signup path, but no page confirming self-serve **test/sandbox
  credentials** specifically was reached — the relevant page is the same bot-walled one.
- **Docs reachability**: `developer.peachpayments.com` is broadly reachable (llms.txt index and
  most `/docs/*.md` pages work), but specific pages intermittently hit a Cloudflare challenge
  (`checkout-authentication.md`, `checkout-response.md`, both blocked this session) —
  inconsistent with the general reachability, and it is exactly the page a developer needs.
- **Recurring API**: NOT ESTABLISHED — the reference index found is oriented around payouts and
  checkout, not subscriptions.
- **Estimated effort (JUDGEMENT)**: 10–16 hours. No backend SDK, a shallower quickstart than
  Yoco's, and the signature page being unreadable via automated fetch twice in a row — a real
  developer would likely lose time hunting the same information via Postman or support.

---

## 5. Paystack

- **Integration model**: VERIFIED. Redirect-to-hosted — backend
  `POST https://api.paystack.co/transaction/initialize`, get back `authorization_url`, redirect
  customer there; a frontend Popup widget (`@paystack/inline-js`) is a second option, still
  needs a backend-initialized `access_code`. Source:
  `paystack.com/docs/payments/accept-payments/` (16,723 chars, confidence high) — full
  copy-pasteable curl example and JSON shape (`authorization_url`, `access_code`, `reference`).
- **Official SDK**: PARTIAL. `@paystack/inline-js` is first-party (GitHub org `PaystackHQ`,
  confirmed via npm `bugs.url`) but is a **frontend** popup widget, not backend. The two
  visible server npm packages (`paystack-node`, `paystack`) are both **community-maintained**
  (GitHub orgs `stitchng` and `kehers`, confirmed via npm `bugs.url`) — no first-party Node
  backend SDK; Paystack's own docs show raw curl/REST, not a wrapped client. TypeScript types on
  the community packages: not established.
- **Quickstart quality**: VERIFIED, good. Complete linear 3-step guide (Initialize → Complete →
  Verify) with real request/response bodies, a security warning against calling the API from
  the frontend, and the response fields to check (`data.status`, `data.amount`) before
  delivering value.
- **Webhooks**: VERIFIED, including signature verification.
  `paystack.com/docs/payments/webhooks.md?no_cache=true` (the `no_cache` param was needed to
  bypass a bot-wall that blocks the same URL otherwise): ready Express handler, retry schedule
  (live: every 3 min ×4 then hourly for 72h; test: hourly for 72h), and
  `x-paystack-signature` — *"a HMAC SHA512 signature of the event payload signed using your
  secret key"* — with a Node `crypto` sample (fetch truncated but algorithm/header confirmed).
  No documented local-webhook test tool found.
- **Sandbox**: PARTIAL/inferred — the webhooks doc distinguishes live vs. test retry behaviour,
  implying self-serve test keys, but no signup/dashboard page was independently fetched this
  session to confirm no approval gate.
- **Docs reachability**: MIXED — worth flagging directly. `paystack.com` docs sit behind a
  Cloudflare bot check that blocked most automated fetch paths this session and in the prior
  sweep (`.agent/memory/scratch/reach/paystack.md`): plain fetch of `/za/pricing`, `.md`-suffix
  fetches, and `?js=true` all returned "Performing security verification" text. Working routes:
  plain fetch for some `/docs/*` subpages, and `?no_cache=true` for others — inconsistent
  page-to-page (`libraries-and-plugins.md` and `webhooks.md` without `no_cache` both stayed
  blocked). This is an automation-specific obstacle (unconfirmed whether real browsers trigger
  it), not a documented docs-quality problem, but it cost more fetch attempts per page than any
  other provider here.
- **Recurring API**: NOT ESTABLISHED this session — not fetched (out of scope for tickets).
- **Estimated effort (JUDGEMENT)**: 6–10 hours. Core integration is as simple as any provider
  here and the quickstart is the most linear of the five; not lower only because of the
  community-only Node SDK and the bot-wall friction encountered by automated fetch.

---

## Fetch budget

Used within the 30-fetch cap; reused facts already on disk from prior-session reachability
sweeps are cited by file path above rather than re-fetched.
