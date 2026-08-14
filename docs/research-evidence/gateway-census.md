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
Stitch's full assessment lives in `stitch-writeup.md`; it is marked IN here, not duplicated.
As of 2026-08-14 this census has zero PENDING rows: the nine that were open (Stitch plus eight
others) were closed out in a dedicated pass — see Section 2 for the evidence behind each.

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
| 7 | **Stitch** (via Stitch Express) | Payments infrastructure, Express self-serve small-merchant tier | YES — Stitch Money (Pty) Ltd, TPPP **and** System Operator | R14.75 (local cards, 2.95%) | None found; 6-month dormancy triggers auto-suspend (no fee, but needs reactivation) | **IN** | full write-up on disk (`stitch-writeup.md`) — self-serve, PASA-registered, no monthly fee, cheapest-found EFT-adjacent rail (Capitec Pay 2%) | VERIFIED |
| 8 | **PayGenius** | SA payment gateway — card + Instant EFT, multi-currency, travel-sector focus | YES — PayGenius (Pty) Ltd, reg. 2008/022833/07 | ~R15.00 (card, "from 3%"); R12.00 (Instant EFT, "from 2%+R2) | **None** — own pricing page states "No Setup Fees / No Monthly Fees / No Refund Fees" | **IN** | own pricing page (`info.paygenius.co.za/fees`) publishes the rate directly; self-serve application form at `info.paygenius.co.za/sign-up`, no sales call needed to see pricing or apply | VERIFIED |
| 9 | **iKhokha** | SA fintech — online gateway (iK Pay Gateway/Pay Link) is a distinct, separately-priced product from its card machines | YES — IKhokha RF (Pty) Ltd | R14.25 (2.85%) | **None** — own Help Centre: "free sign-up with no set up costs or monthly fees" | **IN** | own Help Centre confirms online rate explicitly: "we charge a transaction rate of 2.85% excluding VAT" for iK Pay Gateway/Pay Link, distinct from card-machine rates (2.5–2.75%) | VERIFIED |
| 10 | **Zapper** | QR/app payment provider with hosted-checkout + webhook API for e-commerce | YES — Zapper Marketing (South Africa) (Pty) Ltd | R14.50 (Basic Plan, 2.9%) | **None on Basic Plan** — free, pay-per-transaction only; Business Plan optionally adds R220/month for lower rate | **IN** | own pricing page confirms Basic Plan is free/self-serve with no monthly charge; own developer docs (`zapper.gitbook.io`) confirm redirect/hosted-payment-page + webhook support and e-commerce plugins (WooCommerce, Shopify) — verdict rests on the self-serve **Basic Plan**, not the sales-gated NPO Custom Plan | VERIFIED |
| — | **Netcash** (formerly SagePay) | SA payment gateway — hosted checkout, card, EFT, Instant EFT | YES — Netcash (Pty) Ltd | Not published anywhere, including own site | n/a | **OUT** | NO-PUBLIC-INFORMATION | own docs repeatedly route pricing to a human: "these are pre-determined and agreed fees... obtain fee details from your account manager" and a GitHub integration note says "please email sales@netcash.co.za" for current fees; a separate product (Netcash Shop, a website builder) does publish monthly plans (R0–R1,534pm) but is not the gateway-only product SAOC would use with its existing Next.js site | VERIFIED |
| — | **PayU (South Africa)** | Global card + EFT payment gateway, SA-localised | YES — Payu Payment Solutions (Pty) Ltd | Not published on `southafrica.payu.com` | n/a | **OUT** | NO-PUBLIC-INFORMATION | own SA site's Payment Gateway page ends in a sales gate: "Please fill out the contact form and a sales representative will be in touch with you"; no rate, self-serve signup, or NPO path found anywhere on PayU's own SA domain; third-party "~2%" figures trace to PayU India, not SA | VERIFIED |
| — | **Setcom / SiD Secure EFT** | Setcom (Pty) Ltd, SA payment provider since 1998; SiD Secure EFT (2007) is its consumer-facing Instant EFT product | Not matched to an entity name on the Aug-2024 TPPP PDF in a direct text search this pass | 1.5% published for SiD only; no card rate published anywhere | Pricing page explicitly states "billing for monthly subscription fees is done in advance" without quoting an amount | **OUT** | NO-PUBLIC-INFORMATION | own site: sign-up is a "Merchant Enquiry Form" ("a member of our team will get back to you"), not self-serve; SiD itself is framed as "an additional payment option" bolted onto an existing checkout, not a standalone gateway, and its only published rate (1.5%) is EFT-only — no published card-processing rate despite LinkedIn describing Setcom as also processing "online and mobile credit card" transactions | VERIFIED (onboarding, SiD-only pricing); NOT ESTABLISHED (card rate, PASA entry) |
| — | **2Checkout / Verifone** | Global Merchant-of-Record payment platform | Not found on register (foreign entity; settles in USD/GBP/EUR, not ZAR) | 2.4–3.9% + $0.30–0.45 (published, self-serve "2Sell" signup exists) | R500/$50/£50/€50 minimum payout balance | **OUT** | NO-ZAR-SETTLEMENT | own docs (`verifone.cloud/docs/2checkout/Onboarding/Payouts`): payouts require a minimum balance quoted only in $/£/€, never ZAR; ZAR appears solely as a customer-facing *display/billing* currency, not a merchant settlement currency — self-serve sign-up exists (unlike Adyen/Checkout.com) but the settlement currency itself disqualifies it for an SA NPO needing ZAR into a local account | VERIFIED |
| 15 | **Adumo** | SA payment gateway, mid/large-business focus | YES — Adumo Online (Pty) Ltd | Not published (sales call required) | Not established | **OUT** | NO-PUBLIC-INFORMATION | own docs confirm refunds route via merchant's own bank, adding a party/delay | VERIFIED |
| 16 | **DPO Pay / PayGate** | Same brand family as PayFast | YES — PayGate (Pty) Ltd, **same registration number as Payfast (Pty) Ltd: 1999/017441/07** | n/a | n/a | **OUT** | SAME-OWNER-AS-AN-INCLUDED-PROVIDER | PASA register itself confirms identical entity registration to PayFast — not a second option | VERIFIED |
| 17 | **Stripe** | Global card payment platform | NOT on register | n/a | n/a | **OUT** | NOT-IN-SA | Stripe told a prospective SA merchant directly it does not onboard SA merchants | VERIFIED |
| 18 | **PayPal** | Global online payment wallet | NOT on register | n/a | n/a | **OUT** | NO-ZAR-SETTLEMENT | cannot hold or pay out ZAR | VERIFIED |
| 19 | **Adyen** | Global enterprise payment platform | NOT found on register under this name | Not established | Minimum monthly invoice "often around €1,000+" (multiple independent sources) | **OUT** | ENTERPRISE-ONLY | no self-serve sign-up anywhere — "you must go through a sales process, which can take several weeks" (comparepsp.com); corroborated by 3 further independent sources, not just Adyen's own Cellulant partnership announcement | VERIFIED |
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

## 2. Per-provider notes (newly-resolved this pass, plus prior OUT — IN providers already fully written up on disk per team instruction)

**PayGenius** (now IN) — `info.paygenius.co.za/fees`, `/sign-up`, and the ZAR Merchant Agreement
(fetched 2026-08-14). PayGenius (Pty) Ltd, reg. 2008/022833/07, trading from Cape Town. The
pricing page publishes rates directly — "from 3%" ZAR Visa/Mastercard, "from 2% + R2.00" Instant
EFT — under three explicit headline guarantees: "No Setup Fees / No Monthly Fees / No Refund
Fees." Sign-up is a self-serve application form ("Apply now and become a PayGenius Merchant"),
not a sales call. Two independent third-party sources (portmoni.com, sashares.co.za) corroborate
"no monthly subscription" from outside PayGenius's own marketing. Note: PayGenius's rate is a
"from" figure, not a guaranteed flat rate — final pricing can vary by risk profile, same caveat
that applies to several of the already-IN providers.

**iKhokha** (now IN) — `ikhokha.com/pricing`, `help.ikhokha.com` (fetched 2026-08-14). The
`/pricing` page itself only shows card-machine tiers, but the Help Centre settles the online-gateway
question directly, twice, in near-identical language: "we charge a transaction rate of 2.85%
excluding VAT" for iK Pay Gateway/iK Pay Link, and "free sign-up with no set up costs or monthly
fees." iKhokha's own FAQ also states plainly "our online rates from 2.85%" as distinct from card-
machine rates (2.5–2.75%, tiered by volume). IKhokha RF (Pty) Ltd is Absa-sponsored on the PASA
TPPP register (already established). This resolves the one open question flagged in the prior
pass — the online-gateway rate, isolated from the card-machine rate.

**Zapper** (now IN) — `zapper.com/pricing`, `zapper.gitbook.io/integrations` (fetched 2026-08-14).
Confirms three tiers: **Basic** (free, 2.9%, weekly settlement, no monthly charge), **Business**
(R220pm, 2.5%, daily settlement), and **Custom** ("tailored solution for NPOs... Contact Sales" —
still sales-gated, still no public rate). The verdict turns on the Basic Plan: it is self-serve,
carries no monthly fee, and Zapper's own developer docs confirm a hosted/redirect checkout
("Hosted Payment Page") plus documented HTTP webhook notifications and e-commerce plugins
(WooCommerce, Shopify, Ecwid, Magento) — a genuine fit for a Next.js redirect-checkout + webhook
integration. SAOC does not need the sales-gated NPO tier to use Zapper; Basic already clears every
bar. R500 × 2.9% = R14.50, matching the fee already carried in Section 1.

**Netcash** (now OUT, NO-PUBLIC-INFORMATION) — `shop.netcash.co.za`, `help.netcash.co.za`,
`api.netcash.co.za`, GitHub `Netcash-ZA/PayNow-WooCommerce` (fetched 2026-08-14). Netcash (Pty)
Ltd is a real, PASA-registered SA gateway with a genuine "Pay Now" hosted-checkout product — but
its pricing is never published, on any page checked. Its own Help Centre: "these are pre-
determined and agreed fees... please obtain fee details from your account manager." Its own
GitHub WooCommerce plugin readme: "To receive our latest fees, please email sales@netcash.co.za."
A separate consumer-facing product, **Netcash Shop** (a hosted store-builder, not a gateway-only
integration), does publish monthly plans (Free/R309/R629/R1,534pm) — but that is a different
product from the Pay Now gateway SAOC would plug into its existing Next.js site, so it does not
rescue the verdict. Sales-gated pricing, consistent across three independent pages, is what moves
this from PENDING to OUT.

**PayU (South Africa)** (now OUT, NO-PUBLIC-INFORMATION) — `southafrica.payu.com` (fetched
2026-08-14: `/payment-gateway/`, `/contact/`, `/`). Payu Payment Solutions (Pty) Ltd is PASA-
registered (Absa-sponsored, already established), but PayU's own SA Payment Gateway page ends in
an explicit sales gate: "Please fill out the contact form and a sales representative will be in
touch with you." No rate, no self-serve signup, and no NPO path exists anywhere on PayU's own SA
domain. The "~2%" figure repeated by review aggregators (Capterra, GetApp, Jotform) traces to
PayU's *India* product line, confirmed unrelated to the SA entity's pricing.

**Setcom / SiD Secure EFT** (now OUT, NO-PUBLIC-INFORMATION) — `sidpayment.com` (fetched
2026-08-14: `/pricing/`, `/sign-up/`, `/business/`, `/help/`), LinkedIn (fetched 2026-08-14). SiD's
own pricing page publishes one number — 1.5% transaction fee — but that page also states "billing
for monthly subscription fees is done in advance," a standing clause that implies a monthly charge
exists without ever quoting its amount. Sign-up is explicitly not self-serve: "Merchant Enquiry
Form... a member of our team will get back to you." SiD itself is consistently framed, in its own
copy, as "an additional payment option" bolted onto an existing checkout, not a standalone
gateway — the same structural shape that disqualified the BNPL family, though here the pricing gap
is the deciding fact, since a rate not covering card payments at all is not "no rate," it is "no
rate for the product SAOC would actually need." Setcom's LinkedIn page separately claims it
processes "online and mobile credit card" transactions too, but no pricing, product page, or
sign-up path for that card-processing line was found distinct from SiD's EFT-only product. Still
not matched to a named entity on the Aug-2024 PASA TPPP PDF in a direct text search this pass —
genuinely unresolved on registration, not assumed absent.

**2Checkout / Verifone** (now OUT, NO-ZAR-SETTLEMENT) — `2checkout.com/pricing/2sell/`,
`verifone.cloud/docs/2checkout` (fetched 2026-08-14). Unlike Adyen and Checkout.com, 2Checkout
*does* have genuine self-serve sign-up ("2Sell – Sign Up for Free," an instant account-creation
form) and *does* list ZAR among its 100+ supported billing/display currencies. But its own Payouts
documentation is unambiguous that merchant settlement itself is never in ZAR — minimum payout
balances are quoted only in "$50/£50/€50" — meaning a South African NPO would be paid out in a
foreign currency, not into a ZAR account at an SA bank. ZAR support is customer-facing (letting a
buyer see a ZAR price) rather than merchant-facing. This is the same structural disqualifier as
PayPal, established directly from 2Checkout's own docs rather than inferred from its enterprise
positioning — the "leaning OUT, enterprise-signal" framing from the previous pass is superseded by
this firmer, settlement-currency-specific finding.

**Adyen** (OUT, ENTERPRISE-ONLY — reconfirmed with a firmer basis) — `docs.adyen.com`,
comparepsp.com, todapay.com, airwallex.com, bams.com (fetched 2026-08-14). The Cellulant-
partnership framing from the prior pass undersold the finding: independent, mutually-corroborating
industry sources (four of them, not competing with each other) now confirm directly: "There is no
instant self-service sign-up — you must go through a sales process, which can take several weeks"
(comparepsp.com), and a minimum monthly invoice "often around €1,000 or more" is the standard
entry bar (todapay.com), with airwallex.com and bams.com independently describing Adyen's
onboarding as sales-led with negotiated, non-published pricing. This is now VERIFIED rather than
PARTIAL — both the no-self-serve claim and the minimum-volume claim are corroborated by multiple
independent sources, not just Adyen's own partnership announcement.

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

**Virtual Card Services** — the one item in this batch that stayed genuinely unresolved as a
naming question, not a pricing one: no distinct company was found and no evidence disqualifies it,
because there may be no such distinct company. See row 33 in Section 1 and the note below it.

---

## 3. Remaining open item

Every provider on the original candidate list now carries a resolved IN or OUT verdict except one
naming question:

| Provider | What's missing | How to settle it |
|---|---|---|
| Virtual Card Services | Whether a specific company was intended by this name (vs. a generic bank feature) | Ask the requester what specific "Virtual Card Services" provider was meant |

Nothing in Section 1 is excluded on an unverified reason — every OUT verdict cites a specific,
checkable fact (own-site product description, own-site sales gate, PASA register entry/absence,
independent ownership confirmation, a partner's own announcement naming it as riding on someone
else's gateway, or — for Netcash/PayU/Setcom — a direct quote from the provider's own site routing
pricing to a human with no published number anywhere).
