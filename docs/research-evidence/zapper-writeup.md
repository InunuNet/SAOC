# Zapper — Payment Gateway Write-up

Product assessed: **Zapper Basic Plan** (Standard Services), operator Zapper Marketing (Southern Africa) (Pty) Ltd, Reg. No. 2014/018049/07. Business Plan (R220/store/month) and the sales-gated NPO "Custom Plan" are noted but not the primary subject.
Fetch date for all URLs: 2026-08-14. Primary contract source: Merchant Agreement (2024), zapper.com/wp-content/uploads/2024/11/Merchant-Agreement-2024.Final.pdf, 10 pages, read in full.

## 1. Fees, advertised — VERIFIED (Basic Plan)

- zapper.com/pricing (Alembic flagged this page LOW confidence; corroborated independently by smesouthafrica.co.za): **Basic Plan is free to join, 2.9% fees (excl. VAT), no monthly charges, weekly settlements.**
- On one R500 card ticket ex-VAT at 2.9%: **R14.50**.
- **Discrepancy noted**: Zapper's separate "eCommerce Gateway" marketing page (zapper.com/online-payments/ecommerce-gateway) headlines "Rates from 2.5%," which appears to reference the Business tier's 2.5% rate, not the Basic Plan's 2.9% — do not read "from 2.5%" as the Basic Plan's rate.
- Cheapest rail: NOT ESTABLISHED. Zapper offers payment "via Bank Account" (pay-by-bank) alongside cards, but no separate, lower published rate for that rail was found — the 2.9% appears to be a blended Transaction Fee regardless of rail (see §2).

## 2. Fees, contractual — VERIFIED — MOST IMPORTANT FINDING

Merchant Agreement clause 4.3: **"The percentages used to calculate the Transaction Fee for the Standard Services and the Business Services are set out on the Website at https://www.zapper.com/pricing/."**

The contract itself states no number — it explicitly defers to the pricing page, which Zapper "reserves the right (at its sole discretion)" to change with 30 days' notice (clause 5.1.3, 5.1.5). This mirrors the pattern found for most other providers in this comparison: only Peach states its rate inside the contract itself.

## 3. Monthly / minimum / dormancy fees — VERIFIED against contract

Clause 4.6: "Where the Merchant has **selected the Business Services**, the Merchant will also make payment of the Monthly Fee..." — the Monthly Fee obligation is conditional on choosing Business Services. The Basic/Standard Services carry no Monthly Fee clause anywhere in the agreement, consistent with the "Free" marketing claim.

## 4. Payment types — VERIFIED

- Zapper App (QR scan): in-app linked debit/credit cards, linked bank accounts, linked store/RCS cards, vouchers, and "more than ten supported mobile payment apps" (banking, telco, finance, buy-now-pay-later, crypto wallets) — per zapper.com/online-payments/ecommerce-gateway.
- eCommerce Gateway (for websites): card (Visa/Mastercard debit & credit) and bank account/pay-by-bank, via 5 shopping-cart plugins or Zapper's own JavaScript SDK.
- Recurring/debit orders, Capitec Pay, PayShap by name: NOT ESTABLISHED — not named in any source fetched.
- Donations as a distinct product: NOT ESTABLISHED.
- In-person/hardware ("Zapper Equipment"): covered by clause 11 of the agreement, remains Zapper's property.

## 5. Refunds — PARTIAL

Clause 9: the **Merchant** is responsible for processing refunds to Zapper Users. The Merchant may ask Zapper to process a refund; Zapper "**may, but will not be obliged, to** give such refund" and will only do so if the Merchant has sufficient funds in its Merchant Collections. Clause 9.4: "**The Merchant will not be entitled to any refund on the Transaction Fee** in respect of any refund given for the Zapper Transaction" — the transaction fee itself is non-refundable. No stated time limit for refund requests. The contract text does not explicitly distinguish full vs. partial refunds — silent, so full/partial capability at the contract level is NOT ESTABLISHED (though the WooCommerce/Shopify plugin UX may support partial refunds; not confirmed here).

## 6. Contract term and exit — VERIFIED

- Clause 16.1: **either party may terminate at any time on 30 days' prior written notice.**
- Clause 2.4: Merchant may cancel "without reason and without penalty" within **7 days of application acceptance**.
- Clause 5.2: if Zapper changes fees/services/terms (30 days' notice, clause 5.1), the Merchant may terminate during that notice window if it disagrees.
- No minimum term or auto-renewal penalty clause found.

## 7. Dormancy — NOT ESTABLISHED (silent)

No inactivity/dormancy clause anywhere in the 10-page, 21-clause agreement, confirmed by a full read of the document.

## 8. Settlement — PARTIAL

- Pricing page: Basic Plan = weekly settlements; Business Plan = daily/"next business day" settlements.
- Contract clause 4.13–4.14: Merchant Collections paid to the Merchant Bank Account net of Transaction Fees per the applicable settlement interval, "**subject to inter-bank agreements and other delays outside the control of Zapper**."
- No reserve/rolling-hold percentage or duration clause found anywhere in the agreement — unlike PayGenius's explicit Withheld Portion mechanism, Zapper's contract does not mention a reserve at all.

## 9. Chargebacks and disputes — VERIFIED

- Clause 8: Zapper deducts Chargebacks from Merchant Collections; if funds are nil/insufficient for more than **5 days**, the Merchant must pay within **30 days** of written demand. **No Chargeback fee amount is specified** in the contract (contrast PayGenius, which lists a distinct Chargeback Fee category).
- Forum/law: clause 19.6 — South African law governs; clause 19.7 — Merchant consents to the **non-exclusive jurisdiction of the High Court of South Africa (KwaZulu-Natal Local Division, Durban)**; Zapper may also sue in a Magistrate's Court "even if its claim ... is greater than would otherwise be allowed." **No arbitration clause** — contrasts with iKhokha, whose agreement mandates Pretoria arbitration.
- Clause 19.8: if Zapper wins legal proceedings, the Merchant pays Zapper's collection costs, tracing fees, and legal fees.

## 10. Liability cap — NOT ESTABLISHED (no rand figure)

Clause 14.1: Zapper "**will not be liable for any and all claims, damages, losses, liability, costs and/or expenses (direct, indirect, consequential, special or otherwise), including loss of profits and goodwill** ... other than as a result of Zapper's own gross negligence or wilful intent." This is a liability *exclusion*, not a capped rand amount — no figure appears anywhere in the agreement.

## 11. Service levels — VERIFIED (limited)

Clause 20.2 (System Operator section, applies "to the extent that Zapper acts as a system operator" under the National Payment System Act): "Zapper **will use reasonable endeavours to respond to the Merchant within 2 business days** of receiving notification" of a Services outage. This is a response-time commitment, not an uptime guarantee — no % uptime figure found.

## 12. Customer data — NOT ESTABLISHED

Clause 15 covers Zapper's processing of the **Merchant's own** personal/KYC information for application, service delivery, compliance, and Zapper's "operational business purposes" (disclosable to employees, Regulatory Authorities, the Acquiring Bank, and Third-Party Service Providers). **No clause found granting Zapper rights to market to the Merchant's customers (Zapper Users)**, and **no explicit trans-border data-transfer permission** in the Merchant Agreement text. Note: Zapper Users are separately governed by their own Customer Terms of Use, not reviewed here.

## 13. Non-profit support — PARTIAL, high-value but rate not obtained

Zapper's own pricing page names a **"Custom Plan"** explicitly as: "Tailored solution for **NPOs** or enterprise businesses with substantial turnover or multiple branches and outlets" — this is, per the census, the only provider found anywhere naming NPOs on its own public pricing page. It is entirely **sales-gated** ("Contact Sales"); no rate card, discount percentage, or eligibility criteria could be found in any source fetched. Confirms structural NPO recognition; **the actual discounted rate is NOT ESTABLISHED**.

## 14. Onboarding — PARTIAL

Self-serve online Sign Up Process (clause 2.1); KYC Documents required before the Merchant may start processing (clause 2.3); the Merchant Agreement is accepted by ticking a box during sign-up. No published approval-turnaround time (e.g. hours/days) was found in any source fetched.

## 15. Open questions for the vendor

1. What rate and terms apply under the Custom/NPO plan for a registered SA NPO doing ~R1m once every 3 years?
2. Is there any reserve, rolling hold, or minimum-balance mechanism for new online merchants, given the contract is silent on this?
3. What is the Chargeback Fee amount, if any, on the Basic Plan?
4. Is there a dormancy policy or automatic account closure after prolonged inactivity (~36 months)?
5. Is webhook payload signing/verification available and documented for the HTTP Webhook notification model?
6. What is the typical KYC/FICA approval turnaround for a new Basic Plan sign-up?
7. Does the eCommerce Gateway (card/bank-account checkout) support a fully custom Next.js integration without one of the five listed cart plugins?

## 16. Integration effort — PARTIAL

- **eCommerce Gateway**: hosted checkout, integrated via 5 shopping-cart plugins (Shopify, WooCommerce, Ecwid, nopCommerce, and others per zapper.gitbook.io/integrations/web/ecommerce-plugins) plus **Zapper's own JavaScript Payment Widget** — a client-side embeddable script (`new zapper.payments.PaymentWidget("body", {merchantId, siteId, amount, reference})`), not a server-side SDK.
- **REST API**: documented at zapper.gitbook.io/integrations (Authentication, Invoices, Payments, Refunds, Payment Notifications). Example endpoint: `GET https://api.zapper.com/business/api/v1/merchants/{merchantId}/payments/{zapperId}`.
- **No official Node.js/TypeScript npm SDK found.** An npm search for "zapper payment" surfaced only a small third-party "Zapper Payment Widget/QR renderer" library and Zapper's own internal ESLint-rules package — neither is a payments SDK. A Next.js integration would call the REST API directly or embed the JS widget client-side and verify payment server-side via the Payments API.
- **Webhook signature verification: NOT ESTABLISHED.** The HTTP Webhook docs page (zapper.gitbook.io/integrations/payment-notifications/http-webhook) describes a per-merchant-site configurable notification URL, POSTed on payment completion, with versioned payload models (1.2.0/1.3.0) — but the fetched page contained **no documented signing method, secret, or header** for verifying webhook authenticity. This is a meaningful integration gap relative to iKhokha and PayGenius, where at least a signature mechanism is referenced somewhere.
- Sandbox: a self-serve test/sandbox environment ahead of KYC approval is NOT ESTABLISHED.
