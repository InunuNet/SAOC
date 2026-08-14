# iKhokha (iK Pay Gateway / iK Pay Link) — Payment Gateway Write-up

Product assessed: **iK Pay Gateway** (online/e-commerce), operator Emerge Mobile (RF) Proprietary Limited t/a iKhokha, Reg. No. 2012/067507/07. NOT the card-machine business.
Fetch date for all URLs: 2026-08-14.

## 1. Fees, advertised — PARTIAL

- iK Pay Gateway (the product in scope): **"from 2.85% (excl. VAT)"** for both credit and debit cards. Sources: help.ikhokha.com/why-use-the-ikhokha-payment-gateway ("Enjoy Africa's lowest starting transaction rates, from only 2.85% Excl. VAT"); www.ikhokha.com/pricing FAQ ("our online rates from 2.85%"). Free sign-up, "no set up costs or monthly fees."
- On one R500 card ticket ex-VAT at 2.85%: **R14.25**.
- Cheapest rail: NOT ESTABLISHED. No EFT/other-rail rate is published for iK Pay Gateway specifically; only the card rate is quoted.
- **Conflict found**: a separate product, **iK Pay API** (custom API integration, not the plugin-based Gateway), advertises "Starting at 2% per transaction" (www.ikhokha.com/ik-pay-api). This is a lower headline number for a different product — do not conflate the two when comparing.
- The 2.75%/2.65%/2.55%/2.5% tiered rate table on www.ikhokha.com/pricing is explicitly for **card machines**, not the online gateway — confirmed by the page's own FAQ distinguishing "card machine rates start from 2.75%" vs "online rates from 2.85%."
- A **R2.50 payout fee** applies "every time money is paid into your account" (help.ikhokha.com/transaction-settlements), described in card-machine payout examples; whether it applies to pure online/Gateway-only merchants is NOT ESTABLISHED from the page as fetched.

## 2. Fees, contractual — PARTIAL (document-age caveat)

Only one e-commerce-specific merchant agreement template could be located: "Merchant Agreement E-Commerce" (assets-global.website-files.com, Published/dated 1 Jul 2021 — an older template; a current 2026-dated version could not be confirmed).

- Clause 6.2: "You irrevocably give us permission to debit the bank account held in your name ... on a monthly basis with the following for cards: a merchant service fee; a chargeback fee per chargeback; and an account administration fee **The Merchant fee categories are set out in Schedule A.**"
- Schedule A/B in the template are **blank fee tables** (16 merchant fee categories, e.g. "Local Credit – CNP ... AMT" with a blank "Rate" column) to be completed per merchant — the agreement text itself states no percentage.
- **Verdict: the contract does not commit to a rate; it defers to a per-merchant Schedule/Application Form**, not directly to the public pricing page. Confidence is PARTIAL because the only agreement found predates the current iK Pay Gateway product by several years; a live signup contract could not be pulled.

## 3. Monthly / minimum / dormancy fees — PARTIAL

- Marketing claim: "no monthly fees" (help.ikhokha.com/ik-payment-gateway/why-use-the-ikhokha-payment-gateway: "You get free sign-up with no set up costs or monthly fees").
- The 2021 e-comm agreement's only "fixed monthly service fee" line (clause 5.8) is scoped specifically to optional 3-D Secure participation cost, left blank — not a general account fee.
- No dormancy fee clause found. NOT ESTABLISHED against a current contract (see document-age caveat above).

## 4. Payment types — PARTIAL

- Cards: Visa and Mastercard debit/credit (confirmed, multiple sources).
- Instant EFT, Google Pay, Apple Pay: confirmed via www.ikhokha.com/ik-payment-gateway-wix ("customers can pay ... using card payments, Instant EFT, Google Pay and Apple Pay").
- Recurring/instalment transactions: addressed in the 2021 e-comm agreement (clauses 5.10–5.11), so the underlying rails support them.
- Capitec Pay, PayShap, donations as a distinct product: NOT ESTABLISHED — not named in any source fetched.
- In-person hardware (card machines): yes, but a separate product line from iK Pay Gateway.

## 5. Refunds — PARTIAL / possible contradiction

- help.ikhokha.com/woocommerce-refunds: full or partial refunds from the WooCommerce dashboard, "no extra fees," refunded to customer's account "within 48 hours," subject to sufficient unsettled funds; a manual alternative (e.g. Instant EFT) exists if funds are short.
- **Conflicts with the 2021 e-comm agreement**, clause 14: "You may not give refunds via Electronic Funds Transfer" — likely superseded by the newer refund tooling, but this is exactly the kind of stale-contract-vs-marketing gap the client is worried about; flagged, not resolved.
- No stated time limit for merchant-initiated refund requests beyond the 48-hour payout turnaround.

## 6. Contract term and exit — VERIFIED (2021 template only)

Clause 27: "This agreement will be effective from the date on which it was signed. It will remain valid for an indefinite period until one of the parties ends it by giving to the other 30 (thirty) days' written notice." No auto-renewal or penalty clause found.

## 7. Dormancy — NOT ESTABLISHED

No inactivity/dormancy clause found in the accessible e-comm agreement. Tried: full read of the 13-page e-comm PDF; searches for "iKhokha dormant account terminate."

## 8. Settlement — PARTIAL

- Requires FICA approval before any payout begins (help.ikhokha.com/transaction-settlements).
- Daily-transaction minimum of **R10** to trigger a payout; amounts below roll over.
- Payout timing varies by bank/payout method: ABSA/FNB via iK Flyer-type hardware = next business day; iK Debit Card linked to a GoTymeBank account = same-day (twice daily); other banks/products may take longer. This detail is drawn from card-machine payout scenarios — applicability to a pure iK Pay Gateway online merchant is not explicitly confirmed.
- Reserve/rolling hold: 2021 e-comm agreement clause 6.1 — "We may keep back payment in the case of excessive chargebacks, bankruptcy, fraud, suspected fraud or invalid transactions" — **discretionary, no percentage or duration specified**.

## 9. Chargebacks and disputes — VERIFIED (2021 template)

- Clause 13.4: an "excessive chargeback special merchant" status is triggered by a **1% or higher chargeback-transaction ratio for two consecutive months**, or a **2.5%+ chargeback-dollar-volume ratio for two consecutive months**, giving iKhokha the right to cancel immediately.
- Clause 26: disputes (other than breach disputes) go to **arbitration in Pretoria** under South African law; urgent interim relief may still be sought from a court.
- Clause 30: agreement governed by South African law; iKhokha may also sue in Magistrate's Court regardless of claim size.

## 10. Liability cap — NOT ESTABLISHED

Clause 17: iKhokha excludes liability for outages/network/system failures "unless we acted with gross negligence or fraudulent intent" — a qualitative carve-out, **no rand figure** given anywhere in the document.

## 11. Service levels — NOT ESTABLISHED

No uptime percentage or response-time commitment found in the agreement or help centre for iK Pay Gateway specifically.

## 12. Customer data — PARTIAL

Clause 21 of the 2021 e-comm agreement restricts the *merchant* from disclosing cardholder data to third parties, and permits iKhokha to share merchant information with card schemes/financial institutions for fraud-prevention services (National Merchant Alert Service, etc.). **No clause found granting iKhokha rights to market to the merchant's customers, and no explicit trans-border processing permission** — but a current, separate Terms of Use/Privacy Policy for iK Pay Gateway could not be located and reviewed, so this is not a clean negative.

## 13. Non-profit support — NOT ESTABLISHED

No NPO-specific tier, discount, or KYC entity type found anywhere in the sources fetched (pricing page, FAQ, help centre, e-comm agreement).

## 14. Onboarding — PARTIAL

- Self-serve sign-up at signup.ikhokha.com; must become "FICA approved" before transacting online (iKhokha blog: "Get a call back from an iK Pay Online agent and get FICA approved" — implies some sales-assisted step even in a nominally self-serve flow).
- The 2021 agreement (clause 2.1) references "a full credit survey ... can take up to 2 (two) working days," but this is the general/card-present agreement, not confirmed as the current online-gateway turnaround. No published approval-SLA figure (contrast Flutterwave's ~72h) found for the current product.

## 15. Open questions for the vendor

1. Please provide the current (2026) iK Pay Gateway/e-commerce merchant agreement — the only document found is dated 2021.
2. What is the actual card and EFT rate an NPO with ~R1m/year, once every 3 years, would be quoted — is it the 2.85% "starting" rate or something else?
3. Does the WooCommerce refund process supersede the 2021 agreement's "no EFT refunds" clause, and does the same refund mechanism work through iK Pay Gateway on a custom (non-plugin) Next.js checkout?
4. Is there a dormancy fee or automatic account closure after ~36 months of inactivity?
5. What percentage/duration reserve (if any) applies to a new online merchant in the first months of trading?
6. Is there a published FICA/KYC approval turnaround time for iK Pay Gateway sign-ups?
7. Is there an official Node.js/TypeScript SDK for iK Pay API, or only the example repo?

## 16. Integration effort — PARTIAL

- **iK Pay Gateway** = plugin-based hosted checkout for WooCommerce, Wix, Shopstar, Savvy (www.ikhokha.com/ik-pay-gateway) — none of these fit a custom Next.js site directly.
- **iK Pay API** = REST API for custom sites/developers (developer.ikhokha.com), generated via API Key/Secret in the Merchant Dashboard after signup. Example integrations exist in Go, C#, Dart (Flutter), and **Node.js** ("pay-api-app fullstack example") at github.com/ikhokha/ik-pay-api-examples — but this is a first-party **example repo**, not a published npm package; no official `ikhokha` npm SDK was found in an npm registry search (only an unrelated third-party PHP/Laravel package, `elmmac/ikhokha`).
- Webhook signature verification: a third-party integration-skill summary (lobehub.com, not iKhokha's own docs) states "Verify the ik-sign header using HMAC-SHA256 with your AppSecret and the raw request body," corroborated indirectly by a `webhook_signature`/`$ikSign` field in a third-party GitHub package. **This is not confirmed against iKhokha's own primary documentation** — developer.ikhokha.com is a client-rendered React app and the fetched pages (including with JS rendering) did not surface a webhook/signature doc page directly. Label: PARTIAL, unverified against primary source.
- Sandbox: whether a self-serve sandbox/test environment exists before FICA approval is NOT ESTABLISHED.
