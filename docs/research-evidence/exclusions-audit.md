# Exclusions Audit — Was Every Drop Actually Evidence-Based?

Audits `exclusions-writeup.md` (13 providers, 2026-08-14 baseline) against its own stated reasons,
classifies each as EVIDENCE-BASED or ASSUMPTION, resolves the two already flagged as
under-researched (Peach, Paystack — now have full contract writeups on file), spot-checks the two
weakest generalisations (the four banks; BNPL), and sweeps for South African gateways that were
never on the original list. Client context: SA NPO, ~2,000 tickets @ ~R500 (~R1m), once every 3
years, idle ~36 months between cycles, card-not-present online checkout + webhook, live by end of
August 2026. All fetches via Alembic, 2026-08-14.

## Part 1 — Re-classifying the original 13

| Provider | Original reason | Classification | Verdict |
|---|---|---|---|
| PayFast | kept — already integrated, memberships+tickets, NPO signup | n/a (not excluded) | KEEP (540-day hold still unresolved) |
| Ozow | kept — cheapest, good refunds | n/a (not excluded) | KEEP (contract still unseen) |
| Yoco | no recurring billing (hard) + "empty balance" refund risk (soft) | **MIXED** — no-recurring-billing is EVIDENCE-BASED (Yoco states it directly); the refund-balance argument was an **ASSUMPTION applied inconsistently** — `yoco-writeup.md` (full Merchant Agreement + Payment Services T&Cs read 2026-08-14) confirms PayFast and Ozow have the same structural exposure and were not penalised for it | **KEEP-PENDING** for tickets-only use (see below) |
| Peach Payments | "ran out of research time" | ASSUMPTION (self-admitted — never a disqualifying fact) | **KEEP** — `peach-writeup.md` (35-page MSA, read 2026-08-14) confirms real NPO KYC path, printed fee schedule (2.95%+R1.50, R16.25 on R500), only provider with a quantified SLA (99.0% uptime, service credits) |
| Paystack | "ran out of research time" | ASSUMPTION (self-admitted) | **KEEP** — `paystack-writeup.md` (31k-word MSA read 2026-08-14) confirms charities explicitly eligible (MSA A.1.1), no-Nigeria-required, cheapest rail found anywhere: 2% flat via Capitec Pay/Ozow EFT (R10.00 on R500), no fixed reserve % |
| Adumo | no public pricing; refund routed via merchant's own bank | EVIDENCE-BASED — both facts sourced from Adumo's own docs | DROP (unchanged) |
| DPO Pay / PayGate | same corporate parent as PayFast (Network International → Brookfield) | EVIDENCE-BASED — ownership chain independently confirmed against news coverage of both acquisitions | DROP (unchanged) — confirmed genuinely not a second option, not merely asserted |
| Stripe | doesn't onboard SA merchants directly | EVIDENCE-BASED — Stripe told a prospective SA merchant this directly | DROP (unchanged) |
| PayPal | can't hold/pay out ZAR | EVIDENCE-BASED | DROP (unchanged) |
| 4 banks (FNB/Standard/Absa/Nedbank) | no public pricing, ongoing relationship required — but "we did not individually price each of the four banks" | **ASSUMPTION-by-generalisation** — pattern asserted, not verified per bank | Spot-checked Nedbank below — DROP holds, confidence raised from "pattern" to "pattern + 1 verified instance" |
| BNPL (PayFlex/PayJustNow/Mobicred) | fees not justified at SAOC's price point; PayJustNow refund trap | EVIDENCE-BASED for PayJustNow (refund trap is in PayJustNow's own terms, already quoted); the fee argument for PayFlex/Mobicred specifically was asserted, not individually priced | DROP holds — see below |

### Yoco reconsidered

The exclusions writeup already corrects itself on the double standard. What it doesn't do is
resolve the underlying question: is Yoco fit *for SAOC's actual use case*, which per the client
context above is **tickets only** — no confirmed near-term need for recurring membership billing.
`yoco-writeup.md` (full contract read) adds two new facts the original writeup didn't have:

- Yoco's two governing contracts **conflict with each other** on dispute forum (mandatory Cape
  Town arbitration in the 2020 Merchant Agreement vs. any-court in the newer Payment Services
  T&Cs/Main T&Cs) and on liability cap (full exclusion vs. a stated ZAR 20,000/6-months formula) —
  neither resolves which governs for online ticket sales.
- Card rate confirmed at 2.95% + R2 (R16.75 on a R500 ticket) — marginally more expensive than
  PayFast, cheaper than Peach, more expensive than Paystack's card rate.

**Verdict: KEEP-PENDING**, not KEEP outright — the no-recurring-billing disqualifier is real and
correctly rules Yoco out *if* memberships stay in scope; if they don't, Yoco belongs in a proper
three-way (or four-way, with Peach/Paystack) comparison, which has not yet been done. The original
"ruled out" framing overstated what was actually established.

### Four banks — spot check (Nedbank)

Nedbank's own merchant-services page (`business.nedbank.co.za/commercial-banking/bank/
merchant-services.html`, fetched 2026-08-14) and its published PDF fee schedule
(`nedbank.co.za/.../NedbankBusinesBundlesCharges.pdf`) cover *cardholder* pricing (bundles,
foreign-transaction fees) — no merchant-acquiring rate (the fee Nedbank would charge SAOC to
*accept* card payments) appears on any public page found. The merchant-services page is a
lead-generation page pointing to a sales conversation, matching the original claim's pattern
exactly. **STATUS: pattern confirmed for one bank by direct check, not assumed** — the other three
were not individually re-verified this pass (budget), but the one checked matches the claim
exactly, raising confidence the pattern holds. DROP stands.

### BNPL — PayFlex specifically

Not independently re-verified this pass. The original writeup's refund-trap evidence is
PayJustNow-specific and directly sourced (own published terms) — that finding is solid regardless
of the other two. PayFlex and Mobicred were grouped in on a shared "fees not justified" argument
that was not itemised per-provider. This is a minor unresolved gap, not enough to change DROP: the
category is a poor structural fit for one-off event tickets on card-not-present checkout regardless
of any one provider's exact fee, and Netcash's own site (below) lists PayFlex as a plugin option,
not a reason to reconsider it as a primary gateway.

## Part 2 — New sweep: providers never on the original 13

| Provider | What it is | SA/ZAR fit | R500 fee | NPO path | Disqualifier | Verdict |
|---|---|---|---|---|---|---|
| **Netcash** (formerly SagePay) | SA payment gateway, Pay Now hosted checkout + card, EFT, Instant EFT, PayFlex | Operates in SA, ZAR native, `netcash.co.za` | **NOT ESTABLISHED** — site states "each payment method has a set transaction fee... competitive rates... eligible for a custom quotation" (no published %); Netcash Shop plans (R0/R309pm) are for their bundled storefront, not raw gateway rate | Not found in this pass | Rate not publicly disclosed — same defect class as Adumo's "book a call" pricing | **KEEP-PENDING** — real SA gateway, worth a direct quote request, but currently fails the "publicly readable pricing" bar the audit is checking for |
| **iKhokha (iK Pay Gateway / Pay Link)** | SA fintech, primarily card-machine/POS; has an e-commerce gateway product line | Operates in SA | **NOT ESTABLISHED** — fetched pricing page returned only card-machine (in-person) rates; no online-gateway % surfaced in this pass | Not checked | Primary product and marketing surface is card-machine/in-person; online gateway is a secondary line item | **KEEP-PENDING**, low priority — would need a dedicated pass on `ikhokha.com/pricing` online-gateway section specifically |
| **SnapScan** | QR-code payment app, now owned by **Standard Bank Group** (confirmed via PitchBook + SnapScan's own "About" page, "combining our ingenuity with Standard Bank's... infrastructure") | Operates in SA, ZAR | 2.55%–2.95% ex-VAT, tiered down by monthly turnover (own pricing/merchant page) → **R500 ticket ≈ R12.75–R14.75** | Not found | Primarily a QR/wallet product; hosted-checkout/webhook fit for a Next.js site not confirmed; **and it is a bank-group product**, arguably belonging in the "banks" category the original writeup already excluded on shape grounds | DROP-PENDING — cheap on paper, but same "wrong shape for occasional online ticketing" objection as the four in-house bank options, now that ownership is known |
| **Zapper** | QR/app payment provider | Operates in SA, ZAR | Basic 2.9% ex-VAT (R14.50 on R500); Business plan 2.5% + R220pm | **Explicitly names NPOs**: "Custom Plan... tailored solution for NPOs or enterprise businesses" (own pricing page) | Custom/NPO tier is sales-gated, no published rate | **KEEP-PENDING** — the only new provider found with NPOs named on its own pricing page; worth a direct quote given that explicit signal, but the rate is undisclosed pending a sales conversation |
| **Stitch** | Enterprise-grade SA payments infrastructure (MTN, Takealot, FlySafair are customers) | Operates in SA, ZAR | Advertised "Local online cards from 2.95%, excl. VAT" on `pricing.stitch.money`; exact R500 figure not confirmed (base rate only, possible per-transaction add-on not surfaced) | Not found; positioning is enterprise-first ("About" page: "built for enterprise scale") though a self-serve "Express" tier exists (`express.stitch.money`, Shopify/WooCommerce, sign-up-and-verify flow, no sales call mentioned) | Enterprise focus, but Express tier looks genuinely self-serve for smaller merchants | **KEEP-PENDING** — Express tier is the first new find that looks self-serve *and* has a public base rate; deserves the same contract-level check given to Peach/Paystack |
| **Mukuru / Mukuru Pay** | Cross-border remittance service (send money to/from 60+ countries) | Not a merchant payment gateway — no checkout/webhook product surfaced anywhere in this pass; all material describes person-to-person money transfer | n/a | n/a | **Wrong product category entirely** — this is a remittance service, not an e-commerce payment gateway | **DROP — EVIDENCE-BASED**: no gateway/checkout product exists to evaluate |
| **Flutterwave** | Pan-African payment company, SA-specific onboarding page exists | SA onboarding requirements page confirmed live (`flutterwave.com/za/support/onboarding/...`); **Non-Profit entity is a listed business-registration type** on account creation (own Help Centre article) | **2.9% + ZAR 1** per card transaction; 2.5% ACH/EFT (own `flutterwave.com/za/pricing` page, via search index) → **R500 card ticket ≈ R15.50** | Confirmed selectable at signup | None found that's specific to SAOC's shape; would need contract-level read (settlement timing, reserve, dormancy) before a KEEP call | **KEEP-PENDING** — closest new find to Peach/Paystack in shape: SA-specific page, published rate competitive with PayFast, explicit NPO onboarding option. The one gateway in this sweep that most clearly should not have been absent from the original 13 |
| **2Checkout / Verifone** | Global payment platform, ZAR listed as a supported settlement currency on its own global-coverage page | SA listed with "Currencies: ZAR" on `2checkout.com/global-payments` | **NOT ESTABLISHED** — no ZAR-specific %, only a generic enterprise/negotiated-rate tier structure (Tekpon's third-party summary: "Core / Plus / Enterprise... negotiate tailored rates") | Not found | Product docs consistently describe a global-enterprise sales motion (minimum account balances of $50–100 mentioned in payout docs, in USD/GBP/EUR, not ZAR) — poor shape match for a small triennial NPO | **DROP-PENDING** — nothing found that outright disqualifies it (unlike Stripe/PayPal), but every signal points the same direction as the four banks: enterprise sales process, no public SA rate, no evidence anyone has taken this route for a small SA NPO |

**Excluded from this sweep per instructions** (already covered as one of the 13, or in the current
comparison): Yoco, Ozow, PayFast, Peach, Paystack. **DPO Pay / Direct Pay Online**: this is the
same brand already audited under "PayGate" in Part 1 — confirmed same entity, not re-counted here.

## Part 3 — What should have been in the comparison and wasn't

**Flutterwave** is the clearest miss. Unlike Netcash/iKhokha/Stitch/2Checkout (all KEEP-PENDING on
thin, undisclosed pricing) and unlike SnapScan/Mukuru (DROP on shape/category grounds), Flutterwave
has three things simultaneously that no other new find has: a **South-Africa-specific page**, a
**published ZAR rate** competitive with PayFast (2.9%+R1 vs PayFast's rate), and an **explicit
Non-Profit entity option at signup** — the same combination of signals that justified giving Peach
and Paystack a full contract-level read. It should not have been absent from a 13-provider list
that claims to be a comparison of South African options.

**Zapper** is a close second: the only provider whose own pricing page names NPOs by name, though
its rate for that tier is undisclosed.

## Summary table (for the team lead)

| Provider | Original exclusion reason | EVIDENCE-BASED or ASSUMPTION | R500 card fee | Verdict |
|---|---|---|---|---|
| PayFast | n/a — kept | n/a | ~R14.68 (per existing docs) | KEEP |
| Ozow | n/a — kept | n/a | ~R6–7 cheaper than PayFast | KEEP |
| Yoco | no recurring billing + empty-balance refund risk | MIXED (billing=EVIDENCE, refund-risk=ASSUMPTION, now corrected) | R16.75 | KEEP-PENDING (tickets-only) |
| Peach Payments | "ran out of time" | ASSUMPTION | R16.25 | KEEP |
| Paystack | "ran out of time" | ASSUMPTION | R15.50 card / R10.00 EFT | KEEP |
| Adumo | no public price, refund via bank | EVIDENCE-BASED | not established | DROP |
| DPO Pay / PayGate | same parent as PayFast | EVIDENCE-BASED | n/a | DROP |
| Stripe | no direct SA onboarding | EVIDENCE-BASED | n/a | DROP |
| PayPal | can't hold ZAR | EVIDENCE-BASED | n/a | DROP |
| 4 banks | no public pricing, wrong shape | ASSUMPTION-by-generalisation, spot-checked (Nedbank) | not established | DROP |
| BNPL (PayFlex/PayJustNow/Mobicred) | fees + PayJustNow refund trap | EVIDENCE-BASED (PayJustNow); ASSUMPTION (others, ungrouped) | not established | DROP |
| Netcash | *(new)* | — | not established | KEEP-PENDING |
| iKhokha | *(new)* | — | not established | KEEP-PENDING |
| SnapScan | *(new)* | — | R12.75–R14.75 | DROP-PENDING (bank-owned, wrong shape) |
| Zapper | *(new)* | — | R14.50, NPO tier undisclosed | KEEP-PENDING |
| Stitch (Express) | *(new)* | — | ~R14.75+ (base only) | KEEP-PENDING |
| Mukuru | *(new)* | — | n/a | DROP (wrong product category) |
| Flutterwave | *(new)* | — | R15.50 | KEEP-PENDING |
| 2Checkout/Verifone | *(new)* | — | not established | DROP-PENDING |

**Flutterwave should have been in the original comparison and was not** — it has an SA-specific
page, a published ZAR rate, and an explicit non-profit signup path, the same bar Peach and Paystack
cleared once someone actually looked.
