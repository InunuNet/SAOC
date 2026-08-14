# PayGenius — Payment Gateway Write-up

Product assessed: **PayGenius ZAR Payment Service** (card-not-present, South African Rand acquiring), operator PayGenius (Pty) Ltd t/a PayGenius, Reg. No. 2008/022833/07, Cape Town.
Fetch date for all URLs: 2026-08-14. Primary contract source: "PayGenius Merchant Agreement (ZAR)" at info.paygenius.co.za/general-zar/merchant-agreement-(zar), read in full (36 clauses).

## 1. Fees, advertised — VERIFIED, and "from 3%" confirmed to be a floor, not the flat rate

info.paygenius.co.za/fees (ZAR Card & EFT table):

| Processing Currency | Payment Method | Fee |
|---|---|---|
| ZAR | Visa / Mastercard | **from 3%** |
| ZAR | Diners | from 3.5% |
| ZAR | Amex | from 3.5% |
| ZAR | Instant EFT | **from 2% + R2.00** |
| ZAR | PayPal | from 1% |
| ZAR | Refunds | no fee |

The page itself states: "Fees **can vary** depending on your business type, transaction volume, and risk profile" and offers a "custom pricing quote" — this is explicit confirmation that **"from 3%" is a floor, mirroring the census's Stitch comparison point** (Stitch's "from 2.95%" turned out to be flat; PayGenius's own page language rules that reading out for PayGenius).

- On one R500 card ticket ex-VAT at the floor rate: **R15.00** (actual rate for this merchant profile unknown).
- Cheapest rail: Instant EFT floor rate on R500 = R500 × 2% + R2.00 = **R12.00** (also a floor, not guaranteed).
- No setup fees, no monthly fees banners repeated across the fees page and homepage.

## 2. Fees, contractual — VERIFIED — MOST IMPORTANT FINDING

ZAR Merchant Agreement, clause 4.2: **"Unless otherwise agreed with you in writing, the specific Service Fees applicable to you are as set out in your Application Form or otherwise as set out on the Website."**

The contract does not commit to a rate — it defers to the Application Form (i.e., individually negotiated at signup) or, failing that, the website. Clause 4.4 additionally reserves PayGenius the right to vary Service Fees on **30 days' prior written notice** (with the Merchant entitled to terminate before the change takes effect, but liable for the new fee if it doesn't).

## 3. Monthly / minimum / dormancy fees — PARTIAL, contract text raises a contradiction

Marketing claim (repeated on the fees page and homepage): "No Setup Fees / No Monthly Fees / No Refund Fees."

Contract clause 4.1 lists six Service Fee **types** that may apply: (i) Fixed Successful Transaction Fee, (ii) Variable Transaction Fee, (iii) Chargeback Fee, (iv/4.1.5) **"Refund Fee: a fixed fee on each refund"**, (v) Pay-out Fee, (vi) Wallet Fee. **The contract's own fee taxonomy includes a "Refund Fee" category — this appears to contradict the marketing page's "No Refund Fees" claim.** No general "Monthly Fee" line item appears among the six, which is at least consistent with the "no monthly fee" claim. Flagged as an unresolved contradiction rather than silently reconciled.

## 4. Payment types — PARTIAL

- Visa/Mastercard, card-not-present, credit/debit/hybrid (clause 3.1.1(a)).
- "PayGenius Wallet" transactions (clause 3.1.1(b)) — merchant must integrate/activate the Wallet on its website at no extra cost.
- "Alternative Payment Methods" (APMs), selected in the Application Form (clause 3.1.1(d)) — the specific list of available APMs is not enumerated in the Agreement itself.
- Instant EFT, Diners, Amex, PayPal: confirmed via the fees page (not the ZAR Agreement text).
- Capitec Pay, PayShap by name: NOT ESTABLISHED.
- Recurring/subscriptions: the fees page lists "Subscriptions" as a feature of the separate **Multi-Currency Processing** product ("from 3%," multi-currency), not confirmed as a ZAR-product feature in the Agreement text reviewed.
- Donations, in-person hardware: NOT ESTABLISHED for the ZAR online product.

## 5. Refunds — PARTIAL

Clause 3.3.3: PayGenius "will endeavour to take reasonable steps to process requested refunds ... to the extent that the payment methods used allow," and "may, from time to time, request certain documentation" (proof of sale, delivery, cancellation, or refund request). If PayGenius cannot process a refund because the merchant failed to supply requested documents (or due to law/regulation/banking practice), **the merchant becomes responsible for refunding the customer directly**. No stated time limit. As noted in §3, the contract's own fee list includes a possible Refund Fee despite the marketing page's "No Refund Fees" claim. Full vs. partial refund capability is not explicitly distinguished in the ZAR Agreement text (the fees page lists "Full/partial refunds" as a Multi-Currency Processing feature, not confirmed for the base ZAR product) — PARTIAL.

## 6. Contract term and exit — NOT ESTABLISHED (General Terms inaccessible)

Clause 2 (Duration): the Agreement "shall commence with effect from the date of activation ... and shall endure **until either of us terminates it in accordance with the General Terms**." The specific notice period, minimum term, and any auto-renewal/penalty language live in the separate "**PayGenius General Terms**" document, referenced repeatedly (clause 1.1.2) but which **could not be located** despite: a direct URL guess (info.paygenius.co.za/general-zar → 404), a Brave search restricted to `site:info.paygenius.co.za` (only 2 pages indexed: the homepage and a sign-up form), and general web searches for "PayGenius General Terms." NOT ESTABLISHED.

## 7. Dormancy — NOT ESTABLISHED (silent in the accessible document)

No inactivity/dormancy clause in the ZAR Merchant Agreement's 36 clauses. May be covered in the inaccessible General Terms — flagged as an open question rather than confirmed silence.

## 8. Settlement — VERIFIED reserve mechanism exists; percentage/duration NOT ESTABLISHED

- Clause 3.4.1: net Proceeds paid out "upon the expiry of such periods of time as may be specified in **your Application Form** ('Settlement Periods')" — the settlement timing itself is merchant-specific, not a fixed published number.
- Clause 3.4.3 (Withholding): "a certain percentage of Proceeds ... **as indicated in your Application Form** ('Withheld Portion'), may be withheld for the period described in your Application Form ('Holding Period')." PayGenius may **unilaterally increase** the Withheld Portion and/or Holding Period on written notice if it deems specific transactions suspicious, if the merchant's chargeback/reversal rate is high, or if the merchant otherwise poses increased risk of loss.
- This is the most explicit contractual reserve/hold mechanism found among the three providers in this write-up set — but the actual percentage and duration are set per merchant at signup and were not published anywhere fetched.

## 9. Chargebacks and disputes — PARTIAL

- Clause 3.3.2/4.1.3: a Chargeback Fee is a listed, fixed fee category; **amount not stated** in the Agreement (Application Form/Website).
- Clause 3.2.2(c): "your account balance represents an **unsecured debt** owed by PayGenius to you, which is at risk in the event of PayGenius's insolvency and is **not covered by any compensation scheme** or any other public or private insurance scheme."
- Governing law / dispute forum / arbitration: NOT ESTABLISHED from the ZAR Agreement alone — likely addressed in the inaccessible General Terms.

## 10. Liability cap — NOT ESTABLISHED (no cap on PayGenius's liability to the merchant)

Clause 10 (Disclaimer & Limitation of Liability): no warranties; PayGenius disclaims liability for the accuracy/completeness/error-free operation of the Service, and for "any loss or damages incurred by you ... arising from any transaction executed ... through use of the Service" — a qualitative exclusion, **no rand figure**. The only rand figures anywhere in the document are in clause 9.4, which sets **minimum liquidated damages the merchant owes PayGenius** for prohibited conduct ("at least R20 000 or, in the case of ... prohibited gambling activities, R65 000") — this runs in the opposite direction (merchant's liability to PayGenius), not a cap on PayGenius's liability to the merchant.

## 11. Service levels — VERIFIED (qualitative only, no % uptime)

Clause 10.1: "we shall use reasonable care and diligence to ensure that the Service is available on a **24 hour per day basis** and that requests ... are processed in a timely manner, [but] we make **no representations or warranties** regarding the time it will take to complete processing a transaction." No uptime percentage or response-time SLA figure anywhere in the document.

## 12. Customer data — NOT ESTABLISHED

No clause in the ZAR Merchant Agreement grants PayGenius rights to market to the merchant's customers, and none explicitly permits trans-border data processing. This is a genuine gap rather than a confirmed absence: the broader "PayGenius General Terms," which more plausibly would house data-processing/marketing/trans-border clauses, could not be retrieved (see §6).

## 13. Non-profit support — NOT ESTABLISHED

No NPO-specific tier, discount, or KYC entity type found on the fees page, homepage, or ZAR Merchant Agreement.

## 14. Onboarding — PARTIAL

Self-serve "Sign Up Form" exists (info.paygenius.co.za/copy-of-sign-up); the homepage also offers "Book a free demo," suggesting a sales-assisted path runs in parallel. Clause 1.1.3 confirms an Application Form (hardcopy or electronic) is central to fee-setting and KYC. No published approval-turnaround time (e.g. hours/days) was found anywhere fetched.

## 15. Open questions for the vendor

1. Please provide the "PayGenius General Terms" document — repeatedly referenced but not publicly locatable; needed to confirm contract term/exit, dormancy, dispute forum, and data-processing terms.
2. What is the actual card rate quoted for a registered SA NPO doing ~R1m once every 3 years — is "from 3%" close to what would actually be charged?
3. Does the contract's "Refund Fee" category (clause 4.1.5) actually apply, given the marketing page's "No Refund Fees" claim — and if so, how much?
4. What Withheld Portion (%) and Holding Period (days) would apply to a new merchant in this Application Form, and under what conditions can they be increased?
5. Is there a dormancy policy or account suspension after ~36 months of inactivity?
6. Is webhook signature verification documented, and is there an official Node.js/TypeScript SDK?
7. What governing law, dispute forum, and liability cap (if any) apply to PayGenius, as opposed to the merchant's liability to PayGenius?

## 16. Integration effort — PARTIAL

- developer.paygenius.co.za/docs describes two environments — **Production** (`https://www.paygenius.co.za/`) and **Development** (`https://developer.paygenius.co.za/`) — with API key + token auth, and **Hosted Payment Pages**: "record[ing] information about the transaction through our hosted payment page web service, providing the merchant a URL to redirect the user to" — i.e. a redirect/hosted-checkout integration option, plus "Email Pay" (invoice links). This matches a card-not-present, hosted-checkout pattern suitable for a Next.js site (redirect out, redirect back).
- **No official Node.js/TypeScript SDK found.** An npm registry search for "paygenius" returned **zero packages**.
- **Webhook signature verification: NOT ESTABLISHED.** The only developer-docs page retrieved within budget (Getting Started) does not mention webhooks or payload signing; a dedicated webhook/notification doc page was not located.
- **No WooCommerce/Shopify plugin evidence found.** The only third-party plugin discovered is a **WHMCS** module (marketplace.whmcs.com — a billing/invoicing system, not an e-commerce cart), which is not relevant to a Next.js ticketing site.
- Sandbox: the Development environment (developer.paygenius.co.za) implies a sandbox exists, but whether it is self-serve without an approved application, or requires KYC first, is NOT ESTABLISHED.
