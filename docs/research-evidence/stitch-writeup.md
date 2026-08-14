# Stitch (stitch.money) — Gateway Write-up

Fixed-template write-up for Stitch, South Africa, against the same headings used for the other
six gateways in this project. Facts only — no scoring, no ranking, no cross-provider comparison.

All fetches via Alembic (`curl -s http://localhost:7077/<url>`), 14 August 2026, unless
otherwise dated. Contracting entity throughout: **Stitch Money Proprietary Limited**, registration
**2018/409288/07**.

---

## Threshold questions (answer first)

**(a) Self-serve sign-up, or sales-enquiry-only?**
VERIFIED — self-serve exists. **Stitch Express** is a distinct, live, self-serve product with its
own signup flow at `express.stitch.money/signup` (fetched 2026-08-14: "Sign Up... Use Stitch
Express to securely accept payments on your Shopify, WooCommerce, Squarespace, and Webflow store")
and its own pricing page at `pricing.stitch.money`. The Express Terms & Conditions describe it as
"a product of Stitch which provides payment services to **small, medium and e-commerce
businesses**." No sales call is required to see pricing or sign up. The wider "Stitch" brand
(enterprise) is separately sales-led ("Contact sales" appears on the main stitch.money site
navigation) — but Express is the self-serve small-merchant path and is what this write-up covers.

**(b) PASA-registered?**
VERIFIED — registered as **both** a Third-Party Payment Provider (TPPP) and a System Operator (SO).
- PASA public TPPP list, `Public-list-TPPP-September-2024.pdf` (fetched via r.jina.ai,
  published 2024-09-04): row 112 — **"Stitch Money (Pty) Ltd"**, registration **2018/409288/07**,
  sponsoring bank **Absa Bank Limited**, certified for multiple rails (X marks against six of the
  listed categories including EFT and Card rails).
- PASA public SO list, `Public-list-SO-August-2024.pdf` (fetched via r.jina.ai): entry —
  **"Stitch Money 2018/409288/07 Stitch Money (Pty) Ltd"**, marked for Visa/Mastercard among
  other rails.
- The registration number on both PASA lists (2018/409288/07) matches the entity number in the
  Express T&Cs exactly. The T&Cs' own "Business description" field states: *"Stitch is a payment
  service provider operating as a registered TPPP and System Operator."*

**(c) Settles ZAR to a South African bank account; onboards a non-profit?**
PARTIAL. Settlement: VERIFIED ZAR to a South African account — the T&Cs define **Nominated
Account** as "the South African bank account(s) nominated by You... for the receipt of Client
payments." Non-profit onboarding: PARTIAL — the T&Cs commit only to standard FICA/KYB checks
("know-your-business and onboarding requirements... as set out in FICA") with no entity-type
exclusion list found, and no NPO carve-out or refusal language either. No page or clause naming
NPOs/non-profits specifically as an eligible or ineligible category was found. NOT ESTABLISHED
that an NPO account is guaranteed to pass KYB — only that nothing found forbids it.

**(d) Minimum monthly volume / minimum contract term / minimum monthly fee that would make an
idle-36-months account unviable?**
VERIFIED — none of the three found in the contract, but a **dormancy suspension clause** exists.
- No minimum monthly volume or minimum monthly fee appears anywhere in the Express T&Cs; fees are
  transactional only (see §1–3 below).
- No minimum contract term: either party may terminate — merchant on 30 days' notice, Stitch on
  14 days' notice, "at any time for whatsoever reason."
- Dormancy is explicitly addressed and is the one real risk for a 36-months-idle account:
  *"Stitch shall have the right to immediately suspend or terminate the provision of the Services
  in whole or in part **without notice** to You where You have not processed a Transaction or
  your account has been dormant for 6 (six) months."* (Suspension of Services clause). This does
  not carry a fee, but it means the account will not simply sit ready — it will need to be
  reactivated/re-onboarded before the next show, three years later.

**Conclusion on threshold questions: Stitch clears the self-serve bar via Express, is PASA
TPPP+SO registered, settles ZAR to an SA account, and carries no minimum volume/fee/term — but
will auto-suspend after 6 months of dormancy, which for this client's ~36-month idle cycle is a
real, concrete operational fact, not a formality.**

---

## Headings 1–15

| # | Heading | Answer | Status |
|---|---------|--------|--------|
| 1 | Fees, advertised | Local cards **2.95%**, international cards 3.4%, Capitec Pay 2%, Pay Later (Split) 5.7% — online, all ex-VAT. In-person: local cards 2.5%, international 2.8%. On one R500 ticket ex-VAT via local card: **R14.75**. Cheapest rail advertised: Capitec Pay at 2% (R10 on R500). | VERIFIED |
| 2 | Fees, contractual | The T&Cs **do not state a rate**. Fees clause: *"Service Fees means the fees payable by You to Us for the Services, which fees **can be accessed on the Stitch Express Dashboard or as notified to You by Stitch in writing**."* Stitch may change fees "from time to time" on 14 days' written notice. Rate exists only on the pricing page/dashboard, not in the click-accepted contract. | VERIFIED |
| 3 | Monthly / minimum / dormancy fees | No monthly fee, no minimum-volume fee found. Payout fees: standard payout R2, instant payout R10, ex-VAT (pricing page). Dormancy carries no fee but triggers suspension after 6 months idle (see threshold (d)). | VERIFIED (fees); see (d) for dormancy mechanism |
| 4 | Payment types | Cards (Visa/Mastercard, local + international), Capitec Pay, Pay by bank/instant EFT, Apple Pay, Google Pay, Samsung Pay, manual EFT, debit orders/DebiCheck, Pay with crypto, Pay Later (Split, 2–6 instalments), in-person card via SIP/Terminals. | VERIFIED |
| 5 | Refunds | Refunds processed on merchant instruction, "to the extent the Products allow," only if the Stitch Express Balance covers the refund amount plus applicable Service Fees. **Service Fees are non-refundable** — "The Service Fees are payable irrespective of whether a successful Transaction is subsequently reversed, disputed, or refunded." No refund time-limit stated for Card refunds (a 100-day limit is stated, but only for the separate Pay Later/Split product). Merchant bears the fee. | VERIFIED |
| 6 | Contract term and exit | No minimum term. Merchant: 30 days' written notice to terminate. Stitch: 14 days' written notice, "for whatsoever reason." No auto-renewal language (T&Cs run indefinitely until terminated) and no penalty-on-exit clause found. | VERIFIED |
| 7 | Dormancy | Not silent — explicit 6-month dormancy suspension/termination right, without notice, quoted under threshold (d) above. | VERIFIED |
| 8 | Settlement | Contract itself states no fixed timeframe (funds "held... pending withdrawal and payout"). Support article ("How quickly do funds settle?", support.stitch.money, fetched 2026-08-14) states Card/Crypto/Cash settlement "generally takes place within **T+1** using a custom batch settlement cadence, based on the client's environment" — a support-page claim, not a contractual commitment. Fund Retention clause allows Stitch to **withhold settlement indefinitely** ("for a reasonable period as determined by Stitch, in its sole discretion") where a transaction is subject to chargeback/dispute/reversal, on insolvency risk, on termination, or wherever Stitch judges there is "a risk of financial loss." No percentage or fixed duration reserve is specified — the hold is open-ended and discretionary rather than Flutterwave's stated 10%/180-day figure. | VERIFIED (T+1 support claim; no contractual settlement time); VERIFIED (discretionary, uncapped retention clause) |
| 9 | Chargebacks and disputes | Merchant is "responsible for all chargebacks" and Stitch "shall be entitled to recover all or any chargebacks... from You"; no numeric chargeback fee found in the T&Cs or pricing page. Stitch has no obligation to investigate/challenge a chargeback's validity. Disputes: mediation first (good-faith negotiation), then **binding arbitration under the Arbitration Foundation of Southern Africa (AFSA) rules, seated in Cape Town**, with interim-relief access to the Cape Town High Court. Governing law: South Africa. | VERIFIED (process, forum, governing law); NOT ESTABLISHED (numeric chargeback fee — tried pricing page and T&Cs, not published) |
| 10 | Liability cap | Quoted: *"Stitch's entire liability under or related to these T&Cs, whether for negligence, breach of contract, misrepresentation or otherwise, is limited to **an amount equal to the Service Fees paid by You under these T&Cs in the 12 months immediately preceding the event that gave rise to the claim**."* No rand figure — a formula tied to fees paid, not a fixed sum. Consequential/indirect damages are excluded outright for both parties. | VERIFIED |
| 11 | Service levels | No uptime or response-time SLA appears in the Express T&Cs. Contractual language is a disclaimer, not a commitment: *"Stitch gives no warranty or representation that the Services will be uninterrupted, accessible at all times, timely or wholly free from defects, errors and bugs."* The main stitch.money marketing site separately advertises "99.995% uptime" — a marketing claim, not a contract term, and not confirmed as applicable to Express specifically. | VERIFIED — absent from contract; marketing-only uptime figure noted and explicitly not treated as contractual |
| 12 | Customer data | Marketing-to-merchant's-customers: the general Stitch privacy policy (stitch.money/legal, applicable to "you" as a website/Service data subject) lists a purpose "provide you with marketing material that is relevant to you" among many other processing purposes — ambiguous as to whether "you" reaches the merchant's Clients specifically, since the same policy also covers job applicants, website visitors, etc. Cross-border processing: the separate **Acquiring Service Terms** (for Card Services via Efficacy Payments) state the merchant "consent[s] to Efficacy processing... Merchant Information (including processing such information **outside the borders of South Africa**)." The Express T&Cs' own data clause also permits Stitch to use "third parties located **outside of South Africa**" to process Merchant Data. | PARTIAL — cross-border processing VERIFIED (quoted); a marketing-to-merchant's-customers clause specific to Client data was NOT ESTABLISHED (only a generic, ambiguous "you" marketing purpose in the general privacy policy) |
| 13 | Non-profit support | No discounted NPO tier found anywhere in pricing, Express T&Cs, or site search. No NPO-specific KYB carve-out found either (see threshold (c)). | NOT ESTABLISHED — tried pricing.stitch.money, Express T&Cs, and targeted search for "Stitch non-profit/NPO pricing"; nothing found |
| 14 | Onboarding | Self-serve signup at `express.stitch.money/signup` (no sales call required to start). KYB set per FICA, with ongoing due-diligence rights (Stitch "may carry out verification and ongoing due diligence checks on You and Your directors, affiliates, ultimate beneficiaries... sub-merchants... and Clients"); specific document checklist (e.g. CIPC/NPO registration certificate, ID documents) not itemised in the T&Cs — likely dashboard-driven at signup. Stitch "reserve[s] the right to approve or decline Your registration" with no published approval-turnaround SLA (unlike Flutterwave's ~72h). | PARTIAL — self-serve mechanism and legal basis VERIFIED; document checklist and turnaround time NOT ESTABLISHED |
| 15 | Open questions for the vendor | 1) What is the standard chargeback fee (rand amount) for Stitch Express? 2) What is the typical/maximum duration of a discretionary "Fund Retention" hold, and is there a cap on the percentage of settlement withheld? 3) Does Stitch Express have a published KYB document checklist and approval-turnaround time for a first-time small merchant/NPO? 4) Is there any NPO-specific pricing or KYB treatment? 5) What exactly happens on reactivation after the 6-month dormancy suspension — is re-KYB required, and how long does reactivation take? 6) Does the "T+1" settlement figure quoted in support content apply contractually to Stitch Express Card transactions, or only to Enterprise integrations? | — |

---

## Integration effort

VERIFIED, developer-first as marketed. Hosted/redirect checkout is available via Stitch Express
(Shopify/WooCommerce/Squarespace/Webflow plugins) and a REST/GraphQL API for custom sites. There
is a first-party Node.js SDK, `@stitch-money/node` on npm (latest v1.4.0). Sandbox access is
self-serve and documented at `docs.stitch.money/sandbox` — no approved live account required to
start testing. Webhook signature verification **is documented**: webhooks are delivered via Svix,
with a documented HMAC-SHA256 verification method (`docs.stitch.money/webhooks/using_webhooks`,
also a legacy variant at `/webhooks_legacy`) and an official Svix Node.js/Express verification
library example provided in the docs.

---

## Sources fetched

- `pricing.stitch.money` — Express pricing (2026-08-14)
- `stitch.money/express` — Express product page (2026-08-14)
- `express.stitch.money/signup` — self-serve signup (2026-08-14)
- `stitch.money/express-legal/terms-and-conditions` — full Express T&Cs, Parts A/B/C (2026-08-14)
- `stitch.money/legal/acquiring-service-terms` (Efficacy Card acquiring terms) — cross-border
  clause (2026-08-14)
- `www.stitch.money/express-legal/privacy-policy` — marketing-purpose language (2026-08-14)
- `support.stitch.money/hc/en-us/articles/5607139653521-How-quickly-do-funds-settle` — settlement
  timing (2026-08-14)
- `authorisation.pasa.org.za/wp-content/uploads/2024/09/Public-list-TPPP-September-2024.pdf` (via
  r.jina.ai), published 2024-09-04
- `authorisation.pasa.org.za/wp-content/uploads/2024/08/Public-list-SO-August-2024.pdf` (via
  r.jina.ai)
- `docs.stitch.money/webhooks/using_webhooks` — signature verification (2026-08-14)
- npm: `@stitch-money/node` listing (via search)

Fetch count: 14 (well under the 30 cap).
