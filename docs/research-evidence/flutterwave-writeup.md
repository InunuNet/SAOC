# Flutterwave (South Africa) — Gateway Write-Up

Facts only. No scoring, ranking, recommendation, or cross-provider comparison.
All fetches via Alembic (`curl -s http://localhost:7077/<url>`), dated 2026-08-14 unless noted.

---

## Threshold question — does Flutterwave lawfully operate in South Africa?

**VERIFIED — yes, with caveats.**

- **PASA registration.** PASA's public Third-Party Payment Provider (TPPP) list
  (`https://authorisation.pasa.org.za/wp-content/uploads/2024/09/Public-list-TPPP-September-2024.pdf`,
  fetched via `r.jina.ai`, published 2024-09-04) lists, row 37: **"Flutterwave Technology
  Solutions (Pty) Ltd"**, registration number **2017/146006/07**, sponsoring bank
  **Absa Bank Limited**, certified for Credit Card and Debit Card rails. This is the same
  register type used to verify the other five gateways. VERIFIED.
- **South African corporate entity.** Flutterwave's South Africa-facing Terms & Conditions
  (`flutterwave.com/za/terms`) state: *"We are Flutterwave Technology Solutions (PTY) Limited;
  a company registered under the laws of the Republic of South Africa. Our registered office
  is at 138 West Street, Sandown, Sandton, JHB."* VERIFIED.
- **ZAR settlement to a South African bank account.** Confirmed via: (a) the pricing page's
  ZAR-denominated fee schedule for South Africa; (b) the onboarding support article, which
  states payout options are "direct bank transfers" to SA banks (Nedbank, FNB, Absa, Standard
  Bank, Investec, African Bank, Bidvest Bank, TymeBank) with SWIFT code capture only as an
  optional field; (c) a sample South Africa webhook payload in Flutterwave's developer docs
  showing `"currency": "ZAR"`. VERIFIED — settles in ZAR to an SA account, sponsored by Absa.
- **Can a South African NPO open an account without a Nigerian entity/director?** VERIFIED,
  self-serve. The SA-specific onboarding article
  (`flutterwave.com/us/support/onboarding/onboarding-requirements-for-using-flutterwave-in-south-africa`)
  lists SA-only KYC documents (SARS tax number document, SA ID/passport/driver's licence,
  proof of SA address) with no Nigerian-entity or Nigerian-director requirement. Account
  creation lets the applicant choose **"a registered business account or a non-profit
  entity"** as the account type
  (`flutterwave.com/gb/support/my-account/how-to-create-a-flutterwave-account`), and SA
  approval is stated to take "approximately 72 hours"
  (`flutterwave.com/gb/support/my-account/selecting-the-correct-flutterwave-account`).

**Caveat carried into headings 2, 6, 9, 10 below:** the merchant *contract* itself
(`flutterwave.com/za/merchant-service-agreement`) — unlike the website Terms & Conditions
above — is a Nigeria-templated document even at the `/za/` URL: it defines **"Territory" as
"the Federal Republic of Nigeria,"** references CBN/NIBSS rules throughout, and states its own
governing law and arbitration seat are Nigerian (quoted below). This is a live, unresolved
discrepancy in Flutterwave's public paperwork, not an assumption — see heading 9.

---

## 15 headings

### 1. Fees, advertised
VERIFIED. `flutterwave.com/za/pricing` (fetched 2026-08-14), "Collections for South Africa":
- Cards (local): **2.9% + ZAR 1 per transaction**
- ACH/EFT (wallets & mobile money): 2.5%
- Voucher: 5%
- International cards: 4.8%
- Bank transfer payout: R10 per transfer
- Page footer: *"Pricing excludes Value Added Tax (VAT) and other applicable local taxes."*

On a R500 card ticket ex-VAT: 2.9% × R500 = R14.50, + R1 flat = **R15.50**, matching the
brief's figure.

### 2. Fees, contractual — MOST IMPORTANT HEADING
PARTIAL / VERIFIED-that-it-defers. Merchant Service Agreement (MSA) Clause 9, "Fees & Revenue
Share" (text is garbled by a missing sub-heading in source HTML but the operative language is
intact):

> "…under this Agreement is structured in Annexure 1 and as may be updated from time to time
> on [flutterwave.com/pricing](https://flutterwave.com/za/pricing)… Flutterwave [may]
> reduce/waive its transaction fees provided in Annexure 1 from time to time without recourse
> to the Merchant but shall notify the Merchant of such increase/reduction/waiver immediately
> upon its implementation."

So the click-accepted contract defers to Annexure 1 / the website pricing page, consistent
with the pattern found for the other five gateways (Peach excepted). Flutterwave's clause
does add an explicit commitment to *notify* on change, which is not guaranteed to be present
in the others. This is the MSA at the `/za/` URL, which is the Nigeria-templated document
described in the threshold caveat above — see heading 9 for the governing-law conflict this
creates.

### 3. Monthly / minimum / dormancy fees
VERIFIED (none found). Support article "How much does it cost to create a Flutterwave
account?" (`flutterwave.com/za/support/general/...`): *"You don't need to pay anything to get
started… There are no sign-up or setup costs. We only charge transaction fees when you receive
payments or make transfers."* No monthly or minimum-fee clause found in the MSA or pricing
page.

### 4. Payment types
VERIFIED. SA collection methods per pricing page and onboarding FAQ: card, ACH/EFT, voucher
(1Voucher), Apple Pay, Google Pay, and SA bank collections via Nedbank, FNB, Absa, Standard
Bank, Investec, African Bank, Bidvest Bank, TymeBank. Recurring/subscription support exists
platform-wide per developer docs, but no SA-specific donation-rail confirmation was found.
POS hardware is a Flutterwave product line generally but its SA availability is NOT
ESTABLISHED from the pages fetched.

### 5. Refunds
PARTIAL. MSA Clause 7 ("Chargebacks and Refunds") defines "Refund" as merchant-instructed and
gives Flutterwave the right to debit the merchant's settlement account for the refunded value
"plus other lawful charges." An Egypt-region support article
(`flutterwave.com/eg/support/payments/international-processing-fee-faq`) states processing
fees are *not* included in a refund (i.e. not returned to the merchant), but this is not
confirmed for South Africa. No SA-specific refund-fee or time-limit page was found — NOT
ESTABLISHED for SA.

### 6. Contract term and exit
VERIFIED (subject to the jurisdiction caveat in heading 9). MSA Clause 4: *"This Agreement
shall commence from the date of the last signature… and shall continue for a period of twelve
(12) months ('Initial Term')… Upon expiry… this Agreement shall automatically renew for
successive one (1) year periods until terminated."* Clause 16: either party may terminate on
one month's written notice, or immediately for unremedied material breach (10 business days'
cure period), or immediately by Flutterwave for fraud/brand-damage/regulator instruction. No
early-termination penalty clause was found.

### 7. Dormancy (~36 months idle)
SILENT. No clause in the MSA or the `/za/terms` page addresses account dormancy, inactivity
fees, or automatic closure after a period of no transactions.

### 8. Settlement
PARTIAL. Marketing FAQ on the pricing page: *"You will receive your money the next day for
local payments."* This is not a contractual commitment — MSA Clause 5 only says Flutterwave
"will work with Acquiring Bank to ensure that settlements... [are] handled in a timely
manner," with no defined SLA. **Rolling reserve, contractually confirmed**: MSA Clauses 6.1
and 13 — *"Maintain a 10% rolling reserve from daily settlement due to the Merchant for a
period of 180 days"*; released "on day 181 to the Merchant's bank account." This 180-day/10%
hold is a defined contractual figure.

### 9. Chargebacks and disputes
VERIFIED / PARTIAL, and this is where the jurisdiction conflict lives.
- Chargeback liability: MSA Clause 7 makes any undisputed chargeback "an immediate liability
  from the Merchant to Flutterwave," recoverable by debit, set-off, or invoice, and survives
  termination of the agreement (Clause 7, final bullet).
- Chargeback fee amount: NOT ESTABLISHED for South Africa specifically. A Flutterwave Help
  Center article (`flutterwave.com/eg/support/disputes/how-we-handle-chargebacks`, Egypt-
  localised URL) states *"a dispute fee of $38 or its equivalent is charged for international
  chargebacks"* — no South Africa or local-chargeback figure was found.
- **Governing law / forum — MSA text (Clause 27–28), read at `flutterwave.com/za/merchant-
  service-agreement`:**
  > "In the event of a dispute between Parties… resolution of which cannot be resolved
  > amicably… shall be resolved by arbitration at the **Lagos Court of Arbitration (LCA)**
  > before a single arbitrator in accordance with the **Arbitration and Conciliation Act, Cap
  > A18, Laws of the Federation of Nigeria**… The arbitration shall be held in **Lagos,
  > Nigeria**… This Agreement shall be governed by **the Laws of the Federal Republic of
  > Nigeria**."

  This is **not South African law**, despite being served under the `/za/` path, and despite
  Clause "Applicable Law(s)" in the same document's definitions section being written entirely
  around Nigerian regulators (CBN, NIBSS) and "Territory" being defined as "the Federal
  Republic of Nigeria." By contrast, the separate website Terms & Conditions
  (`flutterwave.com/za/terms`) *are* localised and state: *"These Terms shall be interpreted
  and governed in accordance with the Laws of the Republic of South Africa and you submit to
  the non-exclusive jurisdiction of the Courts located in South Africa."* Flutterwave
  publishes two different legal documents at SA-branded URLs with two different governing-law
  answers; which one actually binds an SA merchant's transaction-level relationship (the MSA,
  which is what a merchant clicks through at onboarding) is a live open question, not
  something I can resolve from public pages alone.

### 10. Liability cap
VERIFIED, but from the same Nigeria-templated MSA flagged above. Clause 15:
> "In no event shall Flutterwave be liable to the Merchant in excess of any amount that has
> accrued to Flutterwave from transactions emanating by virtue of this Agreement, in the month
> immediately preceding the date the first such claim arises… No liability shall be raised
> against Flutterwave more than two (2) years after the accrual of the cause of such
> liability."

No rand figure is quoted — the cap is defined as Flutterwave's own **fee revenue** for the
month preceding a claim, not the transaction value or a fixed rand amount. Separately, the
website Terms & Conditions (`/za/terms`, South African document) carry a broader liability
exclusion in capital letters excluding "DIRECT, INDIRECT, INCIDENTAL, PUNITIVE, CONSEQUENTIAL,
SPECIAL OR EXEMPLARY DAMAGES" with no rand figure at all.

### 11. Service levels
VERIFIED (absent). No uptime or response-time SLA found. `/za/terms` states only: *"FLUTTERWAVE
WILL USE ITS BEST EFFORTS TO ENSURE THAT THE WEBSITE IS AVAILABLE AT ALL TIMES AND BUG FREE.
HOWEVER, IT IS USED AT YOUR OWN RISK."* MSA Clause 10 similarly promises only "best endeavours,"
with an explicit disclaimer that the gateway is not warranted "uninterrupted nor error free."

### 12. Customer data
PARTIAL / NOT ESTABLISHED for the marketing-rights question specifically. `/za/terms`'s "Data
Privacy and Protection" clause states Flutterwave processes personal information "in
compliance with all Data Protection Laws in the territory, in all respects and in particular
[POPIA]." No clause was found in the MSA or `/za/terms` granting Flutterwave a right to market
to the merchant's customers, nor an explicit trans-border-processing consent clause (unlike
Ozow). Given Flutterwave's Nigeria/US corporate structure and the MSA's own Nigeria
jurisdiction (heading 9), cross-border processing of SA data by a Nigeria-governed contracting
entity is a live POPIA question these public documents do not resolve — flagged, not answered.

### 13. Non-profit support
VERIFIED — entity type exists at KYC; NOT ESTABLISHED that it carries a discounted fee
schedule. Sign-up flow explicitly offers **"a registered business account or a non-profit
entity"** as an account type, and the registration-type field is described as *"Sole
Proprietorship, Limited Liability Company, **Non-Profit entity**, etc."*
(`flutterwave.com/gb/support/my-account/how-to-create-a-flutterwave-account`). No separate
non-profit fee schedule was found anywhere on the pricing page or MSA — the 2.9%+R1 card rate
applies regardless of entity type shown. This is an entity-type option at KYC, not a pricing
tier — consistent with the brief's instruction to distinguish the two.

Separately and importantly, the SA-localised Terms & Conditions page lists a
**"Sub-Merchants Requiring Pre-Approval"** category that explicitly includes **"NGO /
Charities"**:
> "Flutterwave shall not solicit or sign agreements with merchants or sub-merchants (i) in any
> of the following categories/businesses… unless Flutterwave is entering into a broad-based
> program… and such program is pre-approved by Flutterwave in its sole discretion. Such
> activities are as follows: … NGO / Charities. …"

This means an NGO/charity account is **not self-serve by default** — it sits in the
"requires pre-approval" tier alongside crypto, lending, and travel services, not the ordinary
onboarding path. Whether a national orchid-show ticketing NPO would be classified as
"NGO/Charity" or as an ordinary event-ticket merchant is not resolved by the public pages.

### 14. Onboarding
VERIFIED. Self-serve signup (email, OTP, business name, entity type, MSA click-through).
SA-specific KYC per `flutterwave.com/us/support/onboarding/onboarding-requirements-for-using-
flutterwave-in-south-africa`:
- Certificate of Incorporation, Memorandum of Incorporation (or equivalent founding document)
- Director/trustee ID + proof of address
- SARS document confirming income tax/VAT number
- Corporate bank account details
- Proof of operational business address
- Bank-stamped bank statements or bank letter
**Approval turnaround is explicitly published: approximately 72 hours**
(`flutterwave.com/gb/support/my-account/selecting-the-correct-flutterwave-account`), one of
the few providers in this set to state a number. Feasibility inside two weeks: plausible on
turnaround time alone, but the NGO/Charity pre-approval requirement (heading 13) means actual
timeline depends on a discretionary approval step not documented publicly.

### 15. Open questions for the vendor
1. Which document governs a South African merchant's contract in practice — the `/za/`
   merchant-service-agreement (Nigerian law, Lagos arbitration, CBN references) or the
   `/za/terms` website terms (South African law)? Confirm in writing which applies.
2. Does SAOC (a registered SA NPO selling National Show tickets) fall under the "NGO /
   Charities" pre-approval category? If so, what is the process and timeline?
3. What is the South Africa-specific chargeback/dispute fee in ZAR (the $38 figure found is
   labelled "international chargebacks" on a non-SA help page)?
4. Is the 2.9%+R1 processing fee refunded to the merchant when a ticket sale is refunded?
5. Given ~36 months of near-idle account time between shows, is there a dormancy fee, forced
   closure, or re-KYC requirement after a defined inactivity period?
6. Is next-day settlement for SA ZAR card transactions a contractual commitment, or only the
   marketing-FAQ statement found?

---

## Integration effort

Hosted/redirect checkout is the default path, with a full API also documented for custom
flows; official first-party Node.js SDK (`flutterwave-node-v3` on npm, `Flutterwave/Node-v3`
on GitHub, plus a `flutterwave-react-v3` front-end package); self-serve sandbox — TEST API
keys issue immediately at signup, no approved live account needed; webhook signature
verification is documented (HMAC-SHA256 over a merchant-set "secret hash," returned in a
`verif-hash`/`flutterwave-signature` header, per `developer.flutterwave.com/docs/webhooks`).
