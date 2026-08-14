# Payment Gateway Decision — South African Orchid Council 2027

*Verified findings: 14 August 2026. Pricing and vendor capabilities subject to change.*

---

## 1. Summary and Recommendation

The Council's 2027 National Show needs a payment gateway by the end of this year to allow advance ticket sales. Six payment providers have been researched against the Council's stated criteria: cheap, refund-capable, and trusted.

**Recommendation: stay on PayFast for the 2027 Show. Add Ozow as a second payment option, subject to vendor clarification questions in section 11.**

Three reasons support this:

1. PayFast's integration is already built, tested, and has been through security review. The ticket flow is proven. Switching gateways weeks before sales open introduces engineering and operational risk for uncertain benefit.

2. PayFast is the only candidate that supports *both* one-off ticket sales *and* recurring membership billing on a single merchant relationship — a requirement the Council confirmed.

3. PayFast explicitly onboards non-profits and is already live in SAOC's production system.

**The strongest argument against it** is real and must be raised with PayFast directly: PayFast's Clause 9.8 permits them to hold sale proceeds for up to 540 days following delivery, and Clause 9.6 lists twelve discretionary triggers for doing so. For a body selling tickets weeks before an event, this is a genuine risk. The Council cannot proceed without a written commitment from PayFast on this point.

Secondary concerns are less critical but real: PayFast has no refund *webhook*, so refund status must be polled rather than pushed into the Council's admin dashboard. The refund API reuses the existing, already-reviewed signature-verification code (MD5-hash-plus-passphrase), so integration effort is modest. There is no official Node SDK — only a PHP one — but the REST API is fully documented and straightforward to wrap.

Ozow is materially cheaper — **roughly R8 per R500 ticket, across every payment method modelled.** Its refund product is real and well-designed. Its recent bank-access upgrades are genuine. But its merchant agreement could not be located for review, its Integration Manual is released only to committed merchants, and no documented path exists for a national council entity to sign up. These are procurement risks worth resolving before a second Show, not migration risks weeks before the first one.

---

## 2. Ozow — the Council's Preferred Option, Assessed on Its Merits

Ozow launched in 2014 and operates as a PASA-licensed Systems Operator and Third-Party Payments Provider.

### Pricing — the decisive advantage

Ozow publishes its pricing in full. No sales call or quote is needed. This alone makes it unusual among South African payment gateways.

**As at 14 August 2026:**

| Payment Method | Fee | Minimum |
|---|---|---|
| Local card (Visa, Mastercard) | 2.85% | R1 |
| International card | 3.5% | R1 |
| Pay By Bank (EFT) | 1.5% | R1 |
| Capitec Pay | 1.5% | R1 |
| Capitec Pay VRP (recurring) | 1.5% | R1 |
| Nedbank Direct EFT | 1.5% | R1 |
| Absa Pay | 1.5% | R1 |
| PayShap Request | 1.5% | R1 |
| Refund per transaction | R3 | — |
| Payout (settlement) | R3 | — |
| Monthly fee | None | — |
| Setup fee | None | — |

No minimum monthly revenue. Enterprise tier applies only above R1.5m per month (irrelevant to the Council).

**Real-world comparison to PayFast (current incumbent):**

- R500 card payment: R14.25 (Ozow) vs R18.00 (PayFast)
- R500 EFT payment: R7.50 (Ozow) vs R10.00 (PayFast)
- R1500 card payment: R42.75 (Ozow) vs R50.00 (PayFast)
- R1500 EFT payment: R22.50 (Ozow) vs R30.00 (PayFast)

Ozow is cheaper on every scenario modelled. This is not marginal — it is consistent and material. **This is the single strongest argument for the Council's preference for Ozow.**

### Bank-Access Mechanism — Real Progress, Ongoing Migration

Ozow's refund product and recurring billing are both routed through bank access. The Council's members deserve candour on how that access is negotiated.

The fair picture, in order:

1. **Capitec Pay is credential-free.** Ozow's own material cites SARB's open-banking vision. This is genuine.

2. **FNB and RMB have recently moved to OAuth authentication.** Between 30 July and 5 August 2026, Ozow launched OAuth-authenticated API payments with both banks, explicitly removing the credential-sharing mechanism. This fact appears in three independent industry sources.

3. **For Standard Bank, Absa and Nedbank, Ozow's training material still documents the older flow:** a customer chooses their bank, logs into their online banking profile, and Ozow performs a transaction on their behalf. This is the mechanism SARB, the FSCA and PASA jointly warned against in November 2020.

4. **Ozow publicly rejected that framing.** The company reports no fraud incidents since its 2014 launch (a self-reported figure). 

5. **Coverage is expanding.** Ozow is actively migrating off the flagged mechanism bank by bank.

**What the Council must do:** Ask Ozow directly which banks are credential-free TODAY, and whether there is a timeline for completing the migration. The company's public commitments suggest movement; the monthly change rate determines whether the risk is acceptable before sales open.

### International Cards — a Necessary Activation Step

Ozow's "Pay By Bank" product handles South African bank-account holders. **International visitors to the Show cannot pay with it.**

Ozow offers a separate "Card Payments" product for genuine Visa and Mastercard acceptance at 3.5% + R1 minimum. **The Council must explicitly activate this in their merchant settings, or overseas Show attendees will see a payment failure.** This is not a default; it is a vendor-specific onboarding step.

### Refunds — Full Product, Real Float Risk

Ozow offers a real refund product: a dashboard interface and an API, full or partial refunds, routed back to the account that paid. **This is a genuine POPIA advantage** — the Council never needs to collect or store members' bank details separately.

**Critical constraint: refunds are funded from a pre-funded float held by Ozow.** If the float is empty, refunds cannot be processed until it is topped up. This is not a soft limit; it is a hard requirement.

Refund timeline: processed twice daily (09h00 and 12h00), weekdays only. Money reflects in the member's account in 48–72 hours.

**Cost of a refund:** R3 per transaction PLUS the original transaction fee is not returned. For a R500 EFT ticket (R7.50 processing fee), issuing a refund costs the Council roughly R10.50 plus returning the R500. (This figure is sourced from merchant service terms via a reseller's published copy and marked as strong but not verbatim-confirmed directly from Ozow for standard merchants — verify with the vendor.)

**Float mechanics:** The Council must understand how to top up the float and what happens if it runs empty during high-volume refund activity. This must be in writing before sales open.

### Recurring Billing — Capitec Pay Only

Ozow supports one recurring product: Capitec Pay VRP (Variable Recurring Payment). This requires a one-time consent from the member; thereafter Ozow collects up to an agreed cap automatically at intervals the Council sets.

**Capitec Pay VRP works for Capitec account holders only.** No equivalent product is confirmed for FNB, Standard Bank, Absa or Nedbank customers. No debit-order alternative is documented. 

A member can cancel a VRP mandate at any time through their Capitec banking app. SAOC is notified after the fact. **The Council must build the workflow to handle mid-cycle cancellations.**

### Settlement Timing — a Contradiction to Resolve

Ozow's public materials state three different settlement timings:

- "Next-day settlement" (pricing page)
- "Same-day settlement for EFT" (FAQ)
- "Settlement once a week for cards" (FAQ)

These are not reconcilable from public documents. **The Council must obtain a written confirmation of settlement timing for each payment method before committing.**

### Non-Profit Onboarding — No Documented Path

Ozow's signup documentation does not mention a non-profit entity type or PBO/NPO path. Two tracks are documented: "Registered Company" (CIPC registration + business bank account) and "Informal Merchant" (individual ID + proof of residence).

SAOC is neither. Account creation is quoted at three hours to two working days depending on complexity. **The Council must confirm in writing which entity path Ozow would use and what documents they would need.** This is not a blocker, but it is an unknown.

### Compliance — Asserted, Not Verified

- PCI-DSS Level 1 claimed on Ozow's website with no certificate number, registrar or expiry date.
- ISO 27001 claimed with no supporting documentation.

(See section 9 for how to verify these claims before signing.)

### Public Reputation

Hellopeter's Trustindex for Ozow shows 2.1 out of 5 stars on 7 reviews submitted in the past 12 months. All are one-star, with recurring themes of delayed payouts and refunds. 

**Important context:** This is a very small sample size; it represents consumer-side feedback, not merchant-side experience; and Hellopeter reviewers are self-selected. Do not overweight it. But do not dismiss it either. **The Council should search for independent merchant testimonials on the company's handling of volume growth and refund backlogs before signing.**

### Merchant Agreement — Unknown Reserve Policy

The Council cannot locate Ozow's standard merchant agreement. This means **the company's fund-hold and reserve practices are unknown.** No reserve clause was found in public materials. This is different from "there is no reserve"; it is "we cannot see the terms before signing."

**This is a material procurement risk.** Before proceeding with Ozow, the Council must review the full merchant agreement and confirm the reserve and fund-hold position in writing.

---

## 3. The Main Alternatives

### PayFast (the Incumbent)

PayFast is Network International's primary gateway for South Africa. It is already live in SAOC's sandbox and production systems.

**Pricing** (confirmed ex-VAT):

- Cards: 3.2% + R2.00
- Instant EFT: 2.0%
- Capitec Pay: 2.0%
- Apple Pay / Google Pay / Samsung Pay: 3.2% + R2.00
- SnapScan: 3.5% + R2.00
- Zapper: 4.5% + R5.00
- Mobicred: 3.2%
- No setup fee, no monthly fee.

PayFast is consistently more expensive than Ozow across every payment method modelled, by R3.50–R8.50 per transaction depending on size and method.

**Settlement** is 48 hours after the transaction clears, then typically 1–2 working days to the merchant's bank. Payout fee is R8.70 ex VAT, flat per payout, whether manual or automated. Batching payouts minimises this cost.

**Refunds — API documented** — PayFast has a fully documented Refunds API reachable at `https://api.payfast.co.za/refunds/`:

- `GET /refunds/query/:pf_payment_id` — query what is refundable and by which method
- `POST /refunds/:pf_payment_id` — create a refund (full or partial)
- `GET /refunds/:pf_payment_id` — retrieve refund status

Authentication uses the same MD5-hash-plus-passphrase scheme SAOC's existing ITN webhook already implements and has had security review. **There is no refund webhook, so refund status must be polled.** There is no official Node/TypeScript SDK, only a PHP one; the REST API is straightforward and can be wrapped in a few lines.

**Refund costs and timing:** Flat R2.00 ex VAT per refund (since 1 October 2020, "irrespective of the amount"). The original acceptance fee is **not returned** — a refunded R150 card ticket costs SAOC roughly R6.80 (the lost original fee) plus R2.00 (the refund fee), proportionally worse on cheaper tickets. Buyer wait: cards 7–10 business days, Instant EFT 2–3 business days.

**PRIVACY CONSIDERATION: Instant EFT refunds require bank details.** Card refunds are reversed down the card rail. However, Instant EFT refunds use a different method (BANK_PAYOUT) and **require SAOC to collect and supply the buyer's bank details: account holder name, bank name, branch code, account number and account type.** This means **SAOC must retain members' bank details to process EFT refunds, a POPIA obligation that does not apply to other gateways** (see section 9). Some transactions cannot be refunded at all (status: NOT_AVAILABLE).

**Explicitly onboards non-profits** — account type selectable at signup. FICA requirement: proof of ID, address and bank account.

PayFast owns SnapScan, Zapper and Mobicred and embeds them inside its payment menu at no extra integration cost — a settings toggle, not a new vendor relationship. Card refunds are available for all three.

**Recurring memberships** — two products support the membership use case. *Subscriptions* (scheduled, including annual billing; Capitec Pay also works) are "designed especially for businesses that run a membership or retainer style business model." *Tokenization* (card-on-file) allows storing a card with an initial R0.00 charge, useful for "join now, bill next year" workflows, with charges triggered by merchant API call (`POST /subscriptions/:token/adhoc`). Caveat: no silent account-updater for expired cards — the customer is sent a link to update their card details on renewal, so renewals are not fully automatic.

**Webhook security:** MD5 hash signature with a shared passphrase, plus source-IP validation. MD5 is weaker hashing than peers, but IP validation is a genuine strength. This is what SAOC's existing integration implements and has undergone security review.

### Yoco

Yoco explicitly onboards non-profit organisations — registered or unregistered, signed up by a chairperson, treasurer or secretary. This nearly exactly fits SAOC's structure. There is also a dedicated NPC path and a dedicated Non-Profit FICA review guide.

Event ticketing does not appear on Yoco's 21-category prohibited list.

**Pricing** depends on turnover and package tier. Starter plan: 2.95% flat, no monthly fee. Pro (R249/month) and Plus (R499/month) tiers trade subscription for lower rates.

**Real-world cost on a R150 ticket:** 2.95% totals R4.43 in processing cost vs R6.80 on PayFast.

**Critical limitation: Yoco does not support subscriptions or recurring billing.** This is decisive for membership revenue. Yoco's own documentation confirms this gap. If the Council intends to sell memberships, Yoco is not an option.

**Refunds — poor fit for SAOC's seasonal pattern.** Yoco has a documented REST API (`POST /checkouts/{id}/refund`, supporting full or partial refunds and idempotency keys) and fires a `refund.succeeded` webhook — more systematic than PayFast. However, Yoco settles the full balance to the merchant's bank account every day, and refunds are drawn from the *pending* balance held by Yoco. According to Yoco's own troubleshooting documentation, refunds often fail because the balance is too low, with three suggested workarounds: wait for new sales, EFT the customer yourself and tell Yoco to cancel the pending refund, or contact support. For a body like SAOC that concentrates all ticket sales into a 3-day window and then sits at zero revenue for months, a refund request arriving 4–6 weeks later will very likely hit an empty Yoco balance. Additionally, Yoco enforces a hard 90-day refund limit, and debit-card payments can only be refunded on the same day. *To Yoco's credit, this limitation is documented transparently;* however, the refund-failure risk is structural and a poor fit for SAOC's use case.

**Webhooks** use HMAC-SHA256 with replay protection and versioned signatures — more modern and stronger than PayFast's MD5.

**PCI compliance** is asserted but no level is stated and no certificate is provided — weaker disclosure than PayFast.

No official Node/TypeScript server SDK exists.

### Peach Payments

Peach explicitly states no monthly fee on the Growth plan — verified against the vendor's published materials. (The R300/month figure circulating in third-party blogs belongs to the Enterprise tier for merchants processing R500k+ per month.)

**Pricing:**

- Cards: 2.95% + R1.50
- Pay by Bank / Capitec Pay / Nedbank Direct EFT: 1.50% + R1.50
- Settlement: next-business-day claimed.

**Refunds** are a first-class transaction type. Checkout webhooks explicitly fire on refund state changes — the strongest refund automation story of any gateway examined. This is genuine engineering investment.

**Webhooks** use HMAC-SHA256, opt-in via a self-service dashboard toggle (added 21 July 2026), plus IP allowlisting and 30-day exponential-backoff retries.

**Gaps:** No official Node/TypeScript server SDK. NPO eligibility and onboarding process are unconfirmed. The company's marketing emphasises enterprise deployments.

### Paystack (the Council's Second Named Candidate, July 2026)

Paystack operates in South Africa and is owned by Stripe, but is a separate product. **The Council would not receive Stripe's product roadmap, support desk or reliability guarantees.** Do not assume a "Stripe reliability halo".

**Pricing** (local South African rates, ex-VAT, plus 15% VAT):

- Local cards: 2.9% + R1.00
- International cards: 3.1% + R1.00
- Capitec Pay and Ozow EFT: 2% flat
- R1 minimum waived under R10
- Payouts: R3
- No monthly or setup fee
- Settlement: T+2 business days, ZAR throughout

**Refunds** are the best-documented of all candidates. Full and partial refunds are supported, multiple partial refunds against one transaction are permitted, and five webhook events are fired including one that fires when bank details need manual supply. Buyers may wait up to 10 business days for settlement.

**Gaps:** No NPO/PBO guidance in the public documentation. No statement on event ticketing as an allowed use case. Must be asked directly.

---

## 4. Ruled Out — and Why

**FNB, Standard Bank, Absa, Nedbank** (direct merchant accounts): All require an ongoing business-banking relationship with pricing behind a sales process or PDF. SAOC transacts once every three years; these are not the right shape for a body with that cadence.

**Adumo:** Pricing gated behind "schedule a demo". Investor materials confirm a subscription-fee component. Support docs state refunds are executed by the merchant's own bank, not Adumo — an extra dependency and support burden. Skip this one.

**DPO Pay / PayGate:** Same corporate parent as PayFast (Network International). PayGate is the gateway-only model for merchants with their own bank merchant account, sold at negotiated prices. This is not an independent alternative; it is a different product shape for a different merchant profile. PayFast is the right product for SAOC.

**Stripe:** Cannot be used by a South African entity. Stripe declined a prospective South African merchant directly with this limitation.

**PayPal:** Cannot hold or receive ZAR. Requires a foreign-currency balance and a bank bridge with FX cost. Not viable for SAOC's revenue model.

**BNPL providers** (PayFlex, PayJustNow, Mobicred as a plan): Fee premiums are unjustified at the R150–R1500 ticket price point. **Real operational risk exists.** PayJustNow's terms state that if a merchant refunds a buyer *directly* (cash, voucher, or EFT), the buyer still owes every remaining instalment. A volunteer refunding cash at the door during the Show could inadvertently leave a member paying off a ticket they returned. Recommend not enabling BNPL.

---

## 5. Refunds — A Cross-Cutting Technical Reality

### The Structural Point

The cheapest payment rails are the hardest to refund. This is not a vendor choice; it is a property of the payment system.

Card networks (Visa, Mastercard, American Express) have built-in reversal flows — they are designed for refunds. Bank-push payments (Instant EFT, Capitec Pay, PayShap) are cheap because no card network sits behind them. The absence of a network is also why money does not flow backwards easily.

### Fund Availability — a Sector-Wide Constraint

Both PayFast and Ozow require funds to be available to process refunds. This is not a distinguishing weakness of either provider; it is a sector-wide characteristic.

- **PayFast** deducts refunds first from held Sale Proceeds; if insufficient, Clause 11.10 reserves PayFast's discretion to debit the merchant's bank account for the shortfall. However, Clause 11.10 also states PayFast may refuse a refund "unless amount to be so refunded has been deposited by you into the Bank Account" — effectively the same failure mode as Ozow's: insufficient funds = refund blocked.

- **Ozow** holds a pre-funded float and refuses refunds if the float is empty. Both refund costs (R3 fee, and the original transaction fee not returned) must be covered by the float.

**Honest assessment:** Neither is cleanly better. Both require available funds. Whichever gateway is chosen, the Council must manage its float (or bank balance) with enough buffer to cover anticipated refund costs.

### Rail-Specific Constraints

- **Capitec Pay cannot be reversed.** Capitec's own words: once approved it cannot be cancelled or reversed. Contact the merchant. A refund is a new, separate outbound payment.
- **PayShap supports one refund per transaction only** (source: Peach's developer documentation). A partial refund burns the refund allocation for that transaction. Group or family bookings with partial refunds become problematic.
- **Apple Pay and Google Pay** refund normally via card rails. Support tip: staff needing to process a refund may require the token's virtual-card last-4, not the physical card's last-4.
- **Zapper has a proper refund API** referencing the original transaction. **SnapScan (standalone QR, outside PayFast) has no confirmed refund path.** Avoid standalone SnapScan for this reason.

### Privacy: Ozow's Advantage, PayFast's Constraint

**Ozow refunds require no personal data.** Ozow routes refunds back to the same account that paid, so the Council never needs to collect or store members' bank account details.

**PayFast card refunds work the same way** — they reverse down the card rail. But **PayFast Instant EFT refunds require the Council to collect and handle the payer's banking details.** The refund request must include account holder name, bank name, branch code, account number and account type. **This means SAOC must retain members' bank details specifically to process EFT refunds, creating a POPIA data-retention obligation that does not apply to other gateways.** For a body with limited IT infrastructure, this is a genuine compliance burden. If SAOC chooses PayFast and sells significant Instant EFT volume, this data-handling workflow must be auditable and properly governed (see section 9 on POPIA).

### SAOC's Own System — a Gap

**The Council's system today cannot represent a refund.** Verification: the word "refund" appears nowhere in the codebase (`app/`, `lib/`, `types/`). TicketStatus in `types/index.ts:128` is `'reserved' | 'paid' | 'cancelled' | 'checked-in'` — there is no refund state.

Today, processing a refund means:

1. Issuing the refund in the gateway's dashboard (or API).
2. Hand-editing the ticket status in Firestore.
3. Documenting the refund somewhere (spreadsheet, email, or not at all).

Nothing links the gateway refund to the Firestore record. A refunded ticket is indistinguishable from one cancelled before payment was ever taken.

**At what volume does this become a problem?** A rough estimate (not a measurement, not a commitment): each refund takes a volunteer 10–20 minutes. At 20 refunds across a Show, this is 3–7 hours. At 200 refunds (perhaps 10% of the Show's ticket volume), this is 30–65 unpaid hours during the week the Council is running the Show.

**The ticket system does not need to build this before sales open, but it will need to before ticket sales close.** The window for building it properly is months, not weeks.

**This is a gap in the Council's system, not a gateway's failure.** Flag it plainly. Whichever gateway is chosen, refund state tracking is a prerequisite for a sustainable operation.

---

## 6. Selling Tickets vs. Selling Memberships — Why the Use Cases Pull Differently

The Council does two things with payment gateways:

1. **Ticket sales for the Show:** one-off transactions, high volume over a short window, high refund likelihood during a specific period, nearly all refunds happen before the event.

2. **Membership billing:** low-volume recurring charges, distributed across the year, members stay or cancel, an easy cancellation mechanism is essential for member retention.

These pull the gateway choice in opposite directions. Ticket sales favour cheap payment rails (EFT, bank access). Memberships favour recurring-billing infrastructure and ease of enrollment.

A gateway strong on one is often weak on the other.

**PayFast supports both.** Its subscriptions API is documented. Recurring billing and tokenised card-on-file are native.

**Yoco does not support recurring billing at all.** It is disqualified for membership revenue.

**Ozow supports only Capitec Pay VRP for recurring** (Capitec account holders only), and requires explicit build-out for cancellation workflows.

**Peach and Paystack** have not been researched for recurring-billing capability.

The Council confirmed requiring both, which narrows the field to PayFast and possibly Ozow with architectural workarounds.

---

## 7. Should SAOC Use a Ticketing Platform Instead?

The Council has built a custom ticket system (reserve, pay, check in). Commercial ticketing platforms (Quicket, uTickets, Webtickets) offer turnkey alternatives.

This section is written with candour about a conflict of interest: we built the custom system, so the choice to use a platform partly means abandoning our work.

### Fee Comparison

**Organiser cost comparison: gateway + custom build vs platform + their embedded gateway, R150 tickets:**

| Volume | Custom + Gateway | Quicket NPO | uTickets |
|---|---|---|---|
| 200 tickets | R600 | R1,553 | R2,100 |
| 500 tickets | R1,500 | R3,881 | R5,250 |
| 1,000 tickets | R3,000 | R7,763 | R10,500 |

**At R400 ticket price, 500 tickets: R4,000 (custom) vs R10,356 (Quicket) vs R14,000 (uTickets).**

Assumptions: gateway fees only; development already spent; no refunds or failed payments modelled; Quicket's R7.50 booking fee included.

The custom build is cheaper in rand-per-ticket. A platform is cheaper in volunteer hours.

### Refunds — Where Platforms Have an Advantage

**Quicket's refund flow is genuinely better than SAOC's today.** An organiser can refund an order in the Quicket dashboard in 1–2 minutes. Because Quicket holds funds until after the event, pre-event cancellations are refunded from money Quicket already holds — no cash-flow strain, no float management.

SAOC's custom system has the refund-state gap documented in section 5.

**But there is a hidden cost:** Quicket's R7.50 booking fee is never refunded to the member, regardless of whether the order is cancelled. And Quicket applies "refund fees" at the same rate as sale commissions — unless SAOC absorbs that cost and pushes it to the cancelling member.

### Fund Hold — a Ticket-Sales Problem

Every South African ticketing platform (Quicket, uTickets, Webtickets, Howler) holds funds until 2–3 working days *after* the event. Quicket pays out T+2 or T+3 post-show.

For SAOC, this is a direct problem. The Council typically pays a venue deposit weeks before the Show (a non-negotiable requirement from most venues). Ticket revenue must flow fast enough to cover it.

**Exception:** uTickets offers next-business-day settlement and a pre-event early-withdrawal option. But uTickets is newer and much smaller (R2m processed, ~500 events) — counterparty risk exists that a larger player does not.

### Memberships — Not Available on Any Platform

**No South African ticketing platform researched — Quicket, uTickets, Webtickets, Howler, Computicket/TicketPro — offers memberships, subscriptions, or recurring billing.**

This means the platform route does not replace a gateway; it *adds* to one. The Council would need:

- A platform for one-off ticket sales
- A separate gateway for membership billing
- Two merchant relationships
- Two fee schedules
- Two places member data lives

This architectural friction favours the custom build, which uses one gateway for both.

### The Honest Framing

The custom build is cheaper in rand per ticket. A platform is cheaper in volunteer hours. Which matters more is a Council judgement, not a finance one.

**Context that dwarfs fee differences:** South African cart abandonment reached 84% in 2025. 62% of consumers who hit a payment failure never return. EFT is the dominant online payment habit in South Africa.

A checkout missing a buyer's preferred payment method costs far more than a 2–3% rate difference. The right question is not "which is cheaper?" but "will our members actually use it?"

---

## 8. VAT — Understanding the Full Cost

Gateway fees are quoted either ex-VAT or incl-VAT, and the pricing pages do not always make this clear. The difference matters.

**Confirmed ex-VAT:**

- **PayFast**: Explicitly labelled "ex VAT" on its fee page. Real cost incl. VAT is 15% higher.
- **Yoco**: 2.95% "ex VAT" — explicitly stated in their help centre. Real cost incl. VAT is 3.39%.

**Unconfirmed (assumed ex-VAT, but NOT labelled):**

- **Ozow**: Pricing page carries no ex/incl-VAT label anywhere. Its terms mention VAT once, on an unrelated AVS fee ("R0.50 excl. VAT"), suggestive of an ex-VAT convention for headline rates, but **not proof**. Critical gap: **if Ozow's rates are VAT-inclusive, Ozow is actually CHEAPER than any comparison table shown in this paper.** The possible error makes Ozow look worse than it is, not better.
- **Peach**: No ex/incl-VAT label on pricing. Status unknown.

**Impact for SAOC:**

- **If SAOC is a registered VAT vendor**: VAT paid on gateway fees is recoverable. Use the ex-VAT figures throughout. On PayFast, R1,500 card ticket costs R50.00 in ex-VAT fees.
- **If SAOC is not registered**: The full 15% VAT is unrecoverable and applies to the final cost. Same R1,500 card ticket costs R57.50 incl. VAT.

**Action required:** Confirm SAOC's VAT status with the treasurer. Add "Confirm whether your published rates are ex-VAT or incl-VAT" to the vendor questions for Ozow and Peach (section 10), with an explicit fairness note: if your rates are incl-VAT, the comparison favours you more than shown here.

---

## 9. Security, Compliance and the Law

### Payment Card Industry Data Security Standard (PCI-DSS)

**All six vendors claim PCI-DSS compliance. No vendor publishes a certificate number, registrar or expiry date.** This is the norm, not the exception. Before signing, **request the certificate and its scope statement, and verify the vendor via the IAF CertSearch public register.**

PCI-DSS certifies a *management system*, not a product. A vendor can be certified for an unrelated part of its business (e.g. the back office) while its payment platform sits outside that scope.

**SAOC's current setup — hosted redirect (customer sent to PayFast's site) — is the lightest tier: SAQ A.** Card data never touches SAOC's servers. SAOC is responsible for TLS on its domain, session handling, webhook signature validation and admin access control; PayFast is responsible for the card data itself.

**PCI-DSS v4.0.1 compliance is mandatory as of 31 March 2025.** Two new requirements bite:

- 6.4.3: Secure payment-page script integrity
- 11.6.1: Tamper detection

These do *not* apply to full-page redirects (PCI SSC FAQ 1588). If the Council ever considers embedding card fields in an iframe or inline form — do not do this for cosmetic reasons. It jumps compliance to SAQ A-EP with real, ongoing obligations.

**Hard design constraint: never move the checkout inline without raising this to the Council in writing.**

### POPIA — Protection of Personal Information Act and Bank Detail Handling

SAOC is the **responsible party**. The gateway is an **operator**.

Section 21 requires a written contract obliging the operator to maintain section 19 security safeguards — i.e., implement reasonable security measures. **SAOC must obtain and sign such a contract with whichever gateway is chosen.**

Section 22 places the breach-notification duty on SAOC, not on the gateway. However, the contract should obligate the gateway to notify SAOC *immediately* on discovering a compromise, so the Council can meet its legal deadline.

**Special note for PayFast Instant EFT refunds:** If SAOC processes Instant EFT refunds through PayFast, it must collect and retain members' bank account details (account holder name, bank name, branch code, account number, account type). This creates a POPIA data-retention obligation. SAOC's data-handling procedures must be auditable and comply with section 19's security requirements. This obligation does not exist for other gateways (Ozow, Yoco, Peach, Paystack), which handle refunds without requiring member banking details. If SAOC chooses PayFast and enables Instant EFT refunds, this workflow must be properly governed.

### ISO 27001

**All vendors claim ISO 27001. No vendor publishes a certificate number, registrar or scope.**

ISO 27001 certifies an information-security management system. Vendors can be certified for unrelated activities. Request the certificate and its scope statement, and verify via the IAF CertSearch register.

### SOC 2

SOC 2 is a US audit report, not a certificate. It is rare among South African gateways. Do not expect it.

### What No Certification Covers

Regardless of the gateway's own certifications:

- SAOC is responsible for TLS on saoc.co.za
- SAOC is responsible for session handling and admin access control
- SAOC is responsible for webhook signature validation
- SAOC is responsible for any personal data stored in Firestore (member names, email addresses, phone numbers)

The gateway's PCI-DSS or ISO 27001 cert does not transfer these obligations.

### Refund Law — Cooling-Off Rights

South African law gives some online buyers a right to cancel. The Council needs to know the boundary.

**The Consumer Protection Act, section 16 (direct marketing):** A 5-day cooling-off right applies to distance contracts. But this applies only to direct marketing (unsolicited offers). A ticket purchase a member initiates themselves is not direct marketing. Section 16 does not apply.

**The Electronic Communications and Transactions Act, section 44 (ordinary online purchases):** A 7-day cooling-off right covers ordinary online transactions.

**But section 42(2)(j) excludes leisure services supplied on a specific date.** A Show ticket for a fixed date falls inside that exclusion.

**The practical outcome:** No statutory cooling-off right applies to Show tickets under either Act. SAOC's own cancellation policy governs, under the Consumer Protection Act, section 17 (reasonable cancellation charges).

Section 17 allows the merchant to impose a cancellation charge if it is *reasonable*. Regulation 5(3) sets reasonableness factors: notice given, ability to resell, actual costs incurred.

Section 17(5) forbids *any* cancellation fee where the ticket-holder has died or been hospitalised.

**Important caveat:** This synthesis is based on primary legal texts (the Consumer Protection Act and the ECTA) and represents a careful reading, not a lawyer's opinion. **The Council must have an attorney review this before publishing a refund policy.**

### Chargeback Implications

**Instant EFT and bank-access payments cannot be charged back.** No consumer dispute mechanism exists.

This is good news for SAOC (no chargeback fees, no fraud losses). But it means a member refused a refund has no bank-mediated recourse. **The Council's own good faith is the only protection a member has.** This is an argument for a generous, clearly published refund policy.

### Recommendation for SAOC's Refund Policy

Recommend a published policy that:

1. States clearly that no statutory cooling-off applies.
2. Sets a sliding-scale cancellation fee justified by real costs (e.g. venue deposit lost, catering order placed, staff time).
3. Waives all fees if the member has died or been hospitalised.
4. Commits to a full unconditional refund if SAOC cancels or postpones the Show.
5. States refund timelines separately per payment method (because Capitec Pay refunds take longer than card refunds, etc.).

---

## 10. Risks to Resolve Before Going Live

1. **PayFast Clause 9.8** — the 540-day retention clause must be raised with PayFast in writing. The Council needs a commitment on this before sales open. Without it, SAOC faces the risk of event revenue being held indefinitely while outstanding balance-sheet disputes are resolved.

2. **PayFast refund automation** — There is no refund webhook, so refund status must be polled rather than pushed via a callback. The refund API exists and is straightforward to integrate (same signature scheme as the existing ITN handler), but active polling adds a small operational burden at high refund volume.

3. **SAOC's refund-state tracking** — The system cannot represent a refunded ticket. Upgrade this before ticket sales close (documented in section 5).

4. **Ozow's settlement timing** — If Ozow is chosen as a second option, obtain written confirmation of settlement timing for each payment method.

5. **Ozow's non-profit onboarding** — If Ozow is chosen, confirm the entity type SAOC would use and required documents in writing.

6. **Ozow's fund-float mechanics** — If Ozow is chosen, understand float top-up workflows before sales open.

7. **International card acceptance** — If Ozow is chosen, ensure Card Payments product is explicitly activated.

8. **Bank-access status** — If Ozow is chosen, ask which banks are credential-free today (section 10). The company is actively migrating; coverage is expanding month to month.

9. **Compliance certificates** — For any gateway chosen, request PCI-DSS and ISO 27001 certificates and verify them via IAF CertSearch before signing.

10. **POPIA operator agreement** — For any gateway chosen, ensure a written POPIA operator agreement is signed, obligating the gateway to notify SAOC on detecting a breach.

11. **Legal review** — Have an attorney review SAOC's refund policy and its legal position under the Consumer Protection Act and ECTA before publishing it.

---

## 11. Questions to Put to the Vendors

Use this numbered list to email each vendor. Copy-paste format.

### To Ozow

1. Which banks are currently credential-free under your current API or OAuth implementation? (As at today's date.)

2. For the remaining banks (those still using the online-banking-login flow), what is your timeline for OAuth migration?

3. Can SAOC enable the "Card Payments" product (for international cards) while disabling the generic "Pay By Bank" product, to give members a choice of which banks to use?

4. Can we see the Integration Manual before we commit to a merchant account?

5. What entity type and FICA documents would SAOC need to provide to sign up as a national council?

6. Does Ozow hold any reserve or fund-hold against merchant accounts? If yes, under what circumstances, and for how long?

7. What is the real settlement timing for cards vs. EFT vs. bank-access payments? (Your public materials state three different figures; we need clarity.)

8. Does the Refunds API emit a webhook when a refund is processed?

9. How does the pre-funded float top-up work? What happens if the float is empty during high-volume refund activity?

10. Can you provide a PCI-DSS certificate with certificate number, registrar, and expiry date?

11. Can you provide an ISO 27001 certificate with certificate number, registrar, and scope statement?

12. Will you sign a POPIA operator agreement obligating you to notify SAOC immediately on detecting a data breach?

13. Confirm whether your published fees (2.85% for local cards, 1.5% for EFT, etc.) are ex-VAT or incl-VAT. (Important: if your rates are incl-VAT, you are actually cheaper than this paper shows.)

14. What is your chargeback fee (for chargebacks that do apply to card payments)?

15. When a refund is issued, is the original transaction fee returned to the merchant?

### To PayFast

1. Under what circumstances would you apply Clause 9.6 or 9.8 (fund hold) to a merchant account selling Show tickets? Specifically: if SAOC takes payment 4 weeks before the Show but delivers the ticket immediately (digitally), would the clock start on payment date or on the Show date?

2. We need this in writing as a term of service, not as an assurance. Can you provide a commitment?

3. Confirm the Refunds API (GET /refunds/query/, POST /refunds/, GET /refunds/) is as documented at https://api.payfast.co.za/refunds/, and whether webhooks are available for refund status changes.

4. Will you sign a POPIA operator agreement obligating you to notify SAOC immediately on detecting a data breach?

5. Confirm whether your published fees (3.2% + R2.00 for cards, 2.0% for Instant EFT, etc.) are ex-VAT or incl-VAT.

6. Can you provide a PCI-DSS certificate with certificate number, registrar, and expiry date?

7. What is your chargeback fee?

8. When a refund is issued, is the original transaction fee (e.g. the R2.00 on a card refund) returned to the merchant?

### To Yoco

1. Event ticketing (one-off ticket sales for a three-day Show) — is this an allowed use case under your terms? Can you confirm in writing?

2. The Checkout API documentation does not mention recurring billing or subscriptions. Is this a confirmed limitation, or does a separate API exist for memberships?

3. Can you provide a PCI-DSS certificate with certificate number, registrar, and expiry date?

4. What is your chargeback fee?

5. When a refund is issued, is the original transaction fee returned to the merchant?

### To Peach Payments

1. Does your offering support recurring billing or subscriptions for memberships?

2. The Checkout Webhook documentation mentions state changes including "refund" events. Can you confirm that Peach Checkout refunds are fully supported (not beta)?

3. Confirm whether your published fees (2.95% for cards, 1.50% for bank access, etc.) are ex-VAT or incl-VAT.

4. Can you provide a PCI-DSS certificate with certificate number, registrar, and expiry date?

5. What is your chargeback fee?

6. When a refund is issued, is the original transaction fee returned to the merchant?

### To Paystack

1. Event ticketing (one-off ticket sales for a three-day Show) — is this an allowed use case under your terms of service? Can you confirm in writing?

2. Does your offering support recurring billing or subscriptions for memberships?

3. Can you provide a PCI-DSS certificate with certificate number, registrar, and expiry date?

4. What is your chargeback fee?

5. When a refund is issued, is the original transaction fee returned to the merchant?

---

## 12. What Is Not Yet Verified — Appendix

- **VAT basis (Ozow and Peach):** Ozow's and Peach's pricing pages do not label their rates as ex-VAT or incl-VAT. PayFast and Yoco are confirmed ex-VAT. For Ozow and Peach, clarification is needed via the vendor questions in section 11. Fairness note: if either is incl-VAT, they are actually cheaper than comparison tables in this paper show.

- **Peach recurring billing:** Peach's offering has not been researched for recurring-billing capability. Before using Peach as a membership processor, this must be confirmed.

- **Paystack recurring billing:** Same gap.

- **Yoco API reference:** The Checkout API reference has not been read end-to-end. Estimated engineering time to migrate from PayFast to Yoco is "weeks", not "months", but this is an estimate. The right time to test this is the start of the next build cycle, not weeks before a Show.

- **Peach / Paystack NPO onboarding:** Eligibility and documentation requirements for non-profit entities are unconfirmed. Must be asked directly.

- **Capitec Pay VRP cancellation workflows:** How a member cancels a VRP mandate in their banking app, and how SAOC is notified, has not been verified with the vendor. The outline (cancellation in banking app, notification after the fact) comes from SAOC's own integration knowledge, not Capitec.

- **All PCI-DSS and ISO 27001 claims:** Every vendor claims compliance but publishes no certificate. This is normal but must be verified before signing.

- **PayFast merchant agreement reserve clause:** Could not be located. Assumed non-existent, but unconfirmed. Must be requested.

- **Ozow merchant agreement:** Could not be located for review before committing. This is a material unknown.

- **Ozow's fraud record:** Self-reported as "no fraud incidents since 2014 launch". Independent verification does not exist.

- **Hellopeter reviews:** Ozow's Hellopeter rating (2.1/5 on 7 reviews) is a small sample, consumer-side, and self-selected. Do not weight this heavily, but do investigate independent merchant testimonials.

- **Refund fee recovery:** It is not confirmed from Ozow's published materials whether the R3 refund fee is deducted from proceeds or is a separate charge. Source is a reseller's published copy of merchant terms, marked as strong but not verbatim-confirmed for direct merchants.

---

## Document Source

This paper draws on research conducted in two phases: June–July 2026 (initial survey) and August 2026 (vendor clarification and public-materials review). Pricing, policies and feature availability are current as at 14 August 2026 and are subject to change without notice.

Developers' conflicts of interest are noted in section 3 (Ozow / Yoco / Peach / Paystack costs are estimated, not measured, because we built the custom system) and section 7 (the fee comparison is our work vs theirs).

Questions or requests for clarification: contact the developer team.
