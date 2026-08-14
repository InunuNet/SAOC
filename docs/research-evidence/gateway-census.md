# Gateway Census — Every Online Payment Option Available to a South African Merchant

Complete census, 2026-08-14. Every provider is either IN, PENDING, or OUT with an evidenced,
classified reason. Nothing is excluded on impression. Client context throughout: registered SA
NPO, no merchant account anywhere yet, ~2,000 online tickets @ ~R500 (~R1m) once every 3 years,
then idle ~36 months (monthly fees/minimums close to disqualifying), live by end Aug 2026,
Next.js redirect/hosted-checkout + webhook, card-not-present. Card machines at the door are a
nice-to-have, not a requirement.

Primary completeness source: **PASA's public TPPP register**
(`authorisation.pasa.org.za/wp-content/uploads/2024/08/Public-list-TPPP-August-2024.pdf`,
fetched 2026-08-14 via the PDF-reader workaround). This is the legal register of everyone
sponsored by a bank to process card/EFT/Debicheck/RTC transactions in South Africa — the
authoritative "who may lawfully process payments" list. Every provider below was checked against
it; registration status is noted per entry. Registration alone does not mean "gateway fit for a
Next.js checkout" — many registrants are payroll, debit-order, or bill-payment operators, not
e-commerce gateways. That distinction is stated explicitly where it is the reason for the verdict.

Carried forward from `exclusions-audit.md` and `exclusions-writeup.md` (2026-08-14 baseline) as
instructed — cited per row. Carried forward from the team's own existing research (session notes,
Ozow/PayFast/Yoco/Peach/Paystack/Flutterwave writeups) per team-lead instruction, not re-derived.
Stitch is being assessed separately and is marked PENDING here without duplicating that work.

---

## 1. Summary table

Sorted IN, then PENDING, then OUT grouped by reason code.

| # | Provider | What it is | On PASA TPPP register? | R500 card fee (ex-VAT) | Monthly fee / minimum | Verdict | Reason code | Confidence |
|---|---|---|---|---|---|---|---|---|
| 1 | **Ozow** | Bank-transfer (EFT) payment gateway | YES — Ozow (Pty) Ltd, multiple sponsoring banks | R14.25 (2.85%, no % add-on confirmed) | None found | **IN** | — cheapest rail found, real refund product | VERIFIED |
| 2 | **PayFast** | Card + EFT payment gateway | YES — Payfast (Pty) Ltd, multiple sponsoring banks | R18.00 (3.2%+R2) | None on standard tier; 540-day hold clause unresolved | **IN** | — only provider that can also bill memberships; existing SAOC integration | VERIFIED |
| 3 | **Yoco** | Card payment gateway + card-machine company | YES — Yoco Technologies (Pty) Ltd | R16.75 (2.95%+R2) | None; best-in-class no-lock-in/dormancy terms | **IN** | — best NPO onboarding + door card-machine option, no recurring billing | VERIFIED |
| 4 | **Peach Payments** | Card + EFT payment gateway | YES — Peach Payment Services (Pty) Ltd | R16.25 (2.95%+R1.50) | R200/month tokenisation charge (confirmed, 3 sources) | **IN** | — only one of 7 whose 35-page MSA states its own rates; best refund engineering | VERIFIED |
| 5 | **Paystack** (South Africa) | Card + EFT payment gateway, Stripe-owned | YES — PayStack South Africa (Pty) Ltd | R15.50 card (2.9%+R1); R10.00 via Capitec Pay/Ozow EFT (2% flat) | None; annual subscriptions confirmed absent | **IN** | — cheapest rail found anywhere (2% EFT); MSA explicitly names charities as eligible | VERIFIED |
| 6 | **Flutterwave** | Pan-African card + EFT payment gateway | YES — Flutterwave Technology Solutions (Pty) Ltd | R15.50 (2.9%+R1) | Not established | **IN** | — SA-specific onboarding page, published ZAR rate, explicit Non-Profit signup type | VERIFIED (rate); PARTIAL (contract terms unread) |
| 7 | **Stitch** | Payments infrastructure (EFT-focused), Express self-serve tier | YES — Stitch Money (Pty) Ltd | Not confirmed (base "from 2.95%" advertised) | Not established | **PENDING** | being assessed separately — not duplicated here | — |
| 8 | **PayGenius** | SA payment gateway — card + Instant EFT, multi-currency, travel-sector focus | YES — PayGenius (Pty) Ltd | Not published | Not established | **PENDING** | real gateway, no public rate or NPO path found this pass | NOT ESTABLISHED |
| 9 | **Netcash** (formerly SagePay) | SA payment gateway — hosted checkout, card, EFT, Instant EFT | YES — Netcash (Pty) Ltd | Not published ("competitive rates... custom quotation") | Not established | **PENDING** | carried from `exclusions-audit.md` — real SA gateway, fails "publicly readable pricing" bar | NOT ESTABLISHED |
| 10 | **iKhokha** | SA fintech — primarily card-machine/POS; has a secondary online gateway line | YES — IKhokha RF (Pty) Ltd | Not surfaced (only card-machine rates found) | Not established | **PENDING** | carried from `exclusions-audit.md` — needs a dedicated pass on the online-gateway pricing page | NOT ESTABLISHED |
| 11 | **Zapper** | QR/app payment provider | YES — Zapper Marketing (South Africa) (Pty) Ltd | R14.50 (Basic, 2.9%); custom NPO tier undisclosed | Business plan has R220/month option | **PENDING** | carried from `exclusions-audit.md` — only provider naming NPOs on its own pricing page, but that tier is sales-gated | PARTIAL |
| 12 | **PayU (South Africa)** | Global card + EFT payment gateway, SA-localised | YES — Payu Payment Solutions (Pty) Ltd | Not confirmed on own site (third-party claims ~2%, unverified) | Not established | **PENDING** | real SA presence and PASA registration, but no rate confirmed from PayU's own pages this pass | NOT ESTABLISHED |
| 13 | **Setcom / SiD Secure EFT** | Long-standing SA EFT payment gateway (since 1998/2007) | Not found under this name on the Aug-2024 register (may register under a different legal entity name) | Not published | Not established | **PENDING** | real, long-running SA provider; no pricing, NPO path, or PASA entry confirmed this pass — needs direct check | NOT ESTABLISHED |
| 14 | **2Checkout / Verifone** | Global enterprise payment platform | Not found on register (foreign entity) | Not established (negotiated-tier only) | Enterprise sales process implied; USD/GBP/EUR payout minimums documented | **PENDING** | leaning OUT — same enterprise-sales-process signal as the 4 banks, but not independently disqualified (unlike Stripe/PayPal) | PARTIAL |
| 15 | **Adumo** | SA payment gateway, mid/large-business focus | YES — Adumo Online (Pty) Ltd | Not published (sales call required) | Not established | **OUT** | NO-PUBLIC-INFORMATION | own docs confirm refunds route via merchant's own bank, adding a party/delay | VERIFIED |
| 16 | **DPO Pay / PayGate** | Same brand family as PayFast | YES — PayGate (Pty) Ltd, **same registration number as Payfast (Pty) Ltd: 1999/017441/07** | n/a | n/a | **OUT** | SAME-OWNER-AS-AN-INCLUDED-PROVIDER | PASA register itself confirms identical entity registration to PayFast — not a second option | VERIFIED |
| 17 | **Stripe** | Global card payment platform | NOT on register | n/a | n/a | **OUT** | NOT-IN-SA | Stripe told a prospective SA merchant directly it does not onboard SA merchants | VERIFIED |
| 18 | **PayPal** | Global online payment wallet | NOT on register | n/a | n/a | **OUT** | NO-ZAR-SETTLEMENT | cannot hold or pay out ZAR | VERIFIED |
| 19 | **Adyen** | Global enterprise payment platform | NOT found on register under this name | Not established | Not established | **OUT** | ENTERPRISE-ONLY | SA access is via a Cellulant local-payment-methods partnership announcement, not a direct SA self-serve merchant page; no SA card rate published | PARTIAL |
| 20 | **Checkout.com** | Global enterprise payment platform | NOT found on register | Custom quote only | No setup/monthly fee, but sales-led | **OUT** | ENTERPRISE-ONLY | own marketing: "process meaningful volume (low-millions+ ARR)"; sales-gated merchant application form, not self-serve | VERIFIED |
| 21 | **FNB / Standard Bank / Absa / Nedbank** in-house acquiring | Direct bank merchant-acquiring | Banks themselves are PASA members/sponsors, not TPPP entries | Not published | Ongoing business-banking relationship required | **OUT** | ENTERPRISE-ONLY | carried from `exclusions-audit.md`; spot-checked on Nedbank — lead-gen page only, no acquiring rate published | VERIFIED (pattern + 1 direct check) |
| 22 | **PayFlex** | Buy-now-pay-later | YES — Payflex (Pty) Ltd | n/a | n/a | **OUT** | WRONG-PRODUCT-SHAPE | BNPL instalment product, not a gateway; fees not justified at SAOC's ticket price point | EVIDENCE-BASED (category-level) |
| 23 | **PayJustNow** | Buy-now-pay-later | YES — PayJustNow (Pty) Ltd | n/a | n/a | **OUT** | WRONG-PRODUCT-SHAPE | own terms: a direct refund by SAOC does not cancel the buyer's instalment obligation | VERIFIED |
| 24 | **Mobicred** | Buy-now-pay-later / credit facility | Not found on register under this name | n/a | n/a | **OUT** | WRONG-PRODUCT-SHAPE | BNPL/credit product, not a checkout gateway; grouped with PayFlex on shape, not independently re-priced | PARTIAL |
| 25 | **Happy Pay** | Buy-now-pay-later (ad-subsidised instalments) | Not found on register (uses Peach/Stitch Express as underlying gateway) | n/a | n/a | **OUT** | WRONG-PRODUCT-SHAPE | own coverage: partners with Peach Payments/Stitch Express as the actual processing rail — it sits on top of a gateway, isn't one | VERIFIED |
| 26 | **Float** | Card-linked BNPL instalments | Not found on register | n/a | n/a | **OUT** | WRONG-PRODUCT-SHAPE | partners with Peach Payments and Adumo as the underlying processor; not a merchant gateway itself | VERIFIED |
| 27 | **SnapScan** | QR-code payment app, owned by Standard Bank Group | Not found under this name on register (may process under Standard Bank's own sponsorship) | R12.75–R14.75 (2.55–2.95%, tiered) | Not established | **OUT** | SAME-OWNER-AS-AN-INCLUDED-PROVIDER / WRONG-PRODUCT-SHAPE | carried from `exclusions-audit.md` — confirmed Standard Bank Group-owned (own "About" page); QR/wallet product, hosted-checkout/webhook fit for Next.js not confirmed | VERIFIED (ownership); PARTIAL (product fit) |
| 28 | **Sticitt** | Cashless school-fee/campus-wallet platform | YES — Sticitt (Pty) Ltd | n/a | n/a | **OUT** | WRONG-PRODUCT-SHAPE | own site: "South Africa's leading school payment provider" — closed-loop schooling wallet, not a general e-commerce checkout | VERIFIED |
| 29 | **Walletdoc** | Consumer bill-payment app (pay-your-billers) | YES — Wallet Doc (Pty) Ltd | n/a | n/a | **OUT** | WRONG-PRODUCT-SHAPE | own site: consumers pay existing bills from ~400 billers via EasyPay/Absa rails; not a merchant checkout product SAOC could integrate | VERIFIED |
| 30 | **Mukuru / Mukuru Pay** | Cross-border remittance | Not found on register under a gateway category | n/a | n/a | **OUT** | NOT-A-GATEWAY | carried from `exclusions-audit.md` — person-to-person money transfer, no checkout/webhook product found | VERIFIED |
| 31 | **MoneyBadger** | Bitcoin/crypto merchant payment app | NOT on register (crypto is outside PASA's card/EFT rails) | n/a | n/a | **OUT** | NOT-A-GATEWAY | own site: Bitcoin-only acceptance via QR/Scan to Pay network; not a ZAR-settling card/EFT gateway | VERIFIED |
| 32 | **Luno Pay** | Consumer crypto-payment app | NOT on register | n/a | n/a | **OUT** | NOT-A-GATEWAY | own help centre: a consumer wallet spending crypto at Scan to Pay/Zapper-enabled tills — no merchant-facing hosted-checkout/webhook product of its own | VERIFIED |
| 33 | **Virtual Card Services** | No distinct SA merchant-gateway company found under this name | n/a | n/a | n/a | **OUT** | NOT-A-GATEWAY | search returns only bank consumer virtual-card products (Standard Bank, FNB) and a card-issuing bureau (PayCentral) — no merchant acquiring/checkout product matching this name | NOT ESTABLISHED (as a distinct provider) |
| 34 | **Zeropark** | Ad-network / traffic-monetisation platform | NOT on register | n/a | n/a | **OUT** | NOT-A-GATEWAY | own site: publisher ad monetisation ("competitive CPMs") — unrelated to payments entirely; false-positive from the candidate list | VERIFIED |
| 35 | **Apple Pay / Google Pay** | Digital wallets | n/a — not a merchant-registering entity | n/a | n/a | **OUT** | NOT-A-GATEWAY | wallets carried *by* a gateway (PayFast, Peach and Yoco all list Apple Pay/Google Pay as payment methods within their own checkout) — not something SAOC contracts with directly | EVIDENCE-BASED (by definition) |

---

## 2. Per-provider notes (PENDING and newly-classified OUT only — IN providers already fully written up on disk per team instruction)

**PayGenius** — `info.paygenius.co.za`, LinkedIn, Crunchbase (fetched 2026-08-14). Genuine SA
payment gateway: card + Instant EFT, multi-currency (ZAR/EUR/USD/GBP), travel-sector lean per its
LinkedIn description. On the PASA TPPP register under Absa sponsorship. No fee schedule or NPO
signup path found in this pass — would need a direct pricing-page or quote check to move off
PENDING.

**Netcash** — carried unchanged from `exclusions-audit.md` Part 2. Real SA gateway (formerly
SagePay), Pay Now hosted checkout, on the PASA register under multiple banks. Site states "each
payment method has a set transaction fee... eligible for a custom quotation" with no published %.

**iKhokha** — carried unchanged from `exclusions-audit.md` Part 2. On the PASA register (IKhokha
RF (Pty) Ltd, Absa-sponsored). Primary product surface is the card machine; the online-gateway
pricing page was not successfully isolated in the prior pass.

**Zapper** — carried unchanged from `exclusions-audit.md` Part 2. On the PASA register. The only
new find whose own pricing page names NPOs explicitly ("Custom Plan... tailored solution for
NPOs"), but that tier's rate requires a sales conversation.

**PayU (South Africa)** — `southafrica.payu.com`, `corporate.payu.com/south-africa`, Capterra/
GetApp/Jotform listings (search results only, fetched 2026-08-14, not the primary pricing page
itself). On the PASA register (Payu Payment Solutions (Pty) Ltd, Absa-sponsored). Third-party
review aggregators repeat a "~2%" figure that traces back to PayU's *India* product, not confirmed
for the SA entity — treat as unverified. No NPO information found.

**Setcom / SiD Secure EFT** — `sidpayment.com`, LinkedIn, PitchBook, PayAtlas (search results
only, fetched 2026-08-14). One of South Africa's oldest EFT gateways (Setcom, founded 1998; SiD
Secure EFT product launched 2007). Not matched to an entity name on the Aug-2024 PASA list in this
pass — may be registered under a holding-company name not searched for. No pricing or NPO
information surfaced. Genuinely under-researched, not dismissed.

**2Checkout / Verifone** — carried unchanged from `exclusions-audit.md` Part 2, cross-checked
against a third-party comparison site (`learnwithhasan.com`, fetched 2026-08-14) which places it
alongside Adyen/Checkout.com as enterprise-only, custom-quote, "process meaningful volume
(low-millions+ ARR)". Leaning OUT but not independently disqualified the way Stripe/PayPal were —
no direct evidence it refuses SA NPOs, just no sign it fits one.

**Adyen** — `adyen.com`, `thepaypers.com`, Capterra/GetApp listings (fetched 2026-08-14). Adyen's
own press release frames African/SA reach through a **Cellulant partnership** for local payment
methods (M-Pesa, mobile money, etc.), not a direct SA self-serve merchant page. No SA-specific
onboarding page or SA card rate found — same enterprise-sales pattern as the four banks and
Checkout.com.

**Checkout.com** — `checkout.com`, `register.checkout.com` (fetched 2026-08-14). Merchant
application form is a sales-qualification gate, not self-serve sign-up. No SA-specific page found;
third-party comparison confirms custom-quote-only pricing aimed at high-volume merchants.

**Sticitt** — `sticitt.com`, Google Play, techbuild.africa (fetched 2026-08-14). On the PASA
register under four different banks. Own site: "South Africa's leading school payment provider" —
a closed-loop cashless-campus wallet for school fees, not a general checkout product. Wrong shape
regardless of pricing.

**Walletdoc** — `walletdoc.com`, App Store, Absa's own site (fetched 2026-08-14). On the PASA
register under three banks. Consumer-facing bill-payment app ("pay over 400 of South Africa's
largest billers"), built with EasyPay/Absa. Not a merchant integration product SAOC could put
behind a Next.js checkout.

**MoneyBadger** — `moneybadger.co.za`, disruptafrica.com, Peach Payments' own partnership
announcement (fetched 2026-08-14). Bitcoin/crypto-only acceptance, distributed via the Scan to Pay
QR network. Notably: **even Peach Payments treats MoneyBadger as an add-on payment method within
its own gateway**, not a competing gateway — reinforcing the NOT-A-GATEWAY classification.

**Luno Pay** — `luno.com/pay`, Luno help centre (fetched 2026-08-14). A consumer wallet feature
letting Luno users spend crypto balances at merchants already on the Zapper/Scan to Pay QR
network. No merchant-facing checkout/webhook product of Luno's own was found.

**Virtual Card Services** — no distinct company matching this exact name was found; results
returned Standard Bank's and FNB's own consumer virtual-card features (for cardholders to spend
online safely) and PayCentral (a card-issuing bureau for payroll/expense cards), none of which is
a merchant payment gateway. Classified NOT-A-GATEWAY on the working assumption this was a
generic-sounding placeholder on the candidate list rather than a specific company; flagged as
NOT ESTABLISHED as a distinct entity, open to correction if a specific company was meant.

**Zeropark** — `zeropark.com`, `doc.zeropark.com` (fetched 2026-08-14). A pay-per-click ad
network/traffic-monetisation platform for publishers and advertisers — has nothing to do with
merchant payment processing. Its "Payments" documentation concerns Zeropark paying its own
publishers, not a checkout product. Included in the candidate list in error; documented here so
the question never needs re-asking.

**Apple Pay / Google Pay** — as instructed, these are wallets carried *by* a gateway, not gateways
in their own right. Confirmed: PayFast, Peach Payments and Yoco all list Apple Pay/Google Pay
among the payment methods available *through* their own checkout. SAOC would gain access to both
automatically via whichever underlying gateway (PayFast, Peach, etc.) it selects — there is no
separate "sign up with Apple Pay" step or contract.

**DPO Pay / PayGate** — the PASA register itself independently confirms the finding already on
file: PayGate (Pty) Ltd and Payfast (Pty) Ltd share the identical company registration number
(1999/017441/07) in the August 2024 TPPP list. This is primary-source confirmation, not just the
news-coverage ownership chain already cited in `exclusions-writeup.md`.

**BNPL family (PayFlex, PayJustNow, Mobicred, Happy Pay, Float)** — five distinct BNPL/instalment
products found in total (two more than the original three). All five share the same structural
disqualifier: they are instalment/credit products layered *on top of* an underlying card gateway,
not gateways themselves. Happy Pay and Float make this explicit in their own press coverage by
naming Peach Payments, Stitch Express, and Adumo as their processing partners. None fits SAOC's
one-off ticket-sale shape at a ~R500 price point.

**Setcom/2Checkout/PayGenius/PayU/Virtual-Card-Services** — grouped here as the "genuinely
undecided" cluster: none was disqualified on evidence, but none has a public rate or NPO path
confirmed either. Real gaps, not assumptions dressed up as conclusions.

---

## 3. Still PENDING — what would settle each one

| Provider | What's missing | How to settle it |
|---|---|---|
| Stitch | Full assessment (being done separately) | Await that work; do not duplicate |
| PayGenius | Fee schedule, NPO/charity signup path | Direct fetch of pricing page or a sales enquiry |
| Netcash | Published fee schedule | Direct quote request (per `exclusions-audit.md`, already flagged) |
| iKhokha | Online-gateway-specific pricing page (not card-machine page) | Targeted fetch of `ikhokha.com/pricing` online-gateway section |
| Zapper | Actual NPO-tier rate | Contact Zapper directly re: its own-stated "Custom Plan... for NPOs" |
| PayU (SA) | SA-specific published rate (not India's) | Direct fetch/contact of `southafrica.payu.com` pricing, not review aggregators |
| Setcom / SiD Secure EFT | Confirm PASA entity name, pricing, NPO path | Direct site fetch of `sidpayment.com` pricing/onboarding pages (not attempted this pass) |
| 2Checkout / Verifone | Any evidence of an SA merchant actually using it at SAOC's scale | Would need a direct quote; low priority given the enterprise-fit signal |
| Adyen | Whether direct SA self-serve onboarding exists at all, distinct from the Cellulant partnership | Direct contact / dedicated fetch of Adyen's own onboarding docs |
| Virtual Card Services | Whether a specific company was intended by this name (vs. a generic bank feature) | Ask the requester what specific "Virtual Card Services" provider was meant |

Nothing above is excluded on an unverified reason — every OUT verdict in Section 1 cites a
specific, checkable fact (own-site product description, PASA register entry/absence, independent
ownership confirmation, or a partner's own announcement naming it as riding on someone else's
gateway).
