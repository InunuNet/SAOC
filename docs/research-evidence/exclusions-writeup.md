# Why Each Payment System Was Ruled In or Out

This is a plain-English companion to the payment gateway research. It answers a question the
Council asked directly: not just "which one did you pick?" but "what happened to all the others,
and why?"

For each payment system, three things:

- **What it is**, in one sentence.
- **Why it was ruled in or out**, stated as a fact — not a feeling.
- **How sure we are of that reason**, and where it came from. Some of this research is solid.
  Some of it is thin. You deserve to know which is which.

We also flag, where relevant, whether the reason would still apply if the Council's plans change
— for example, if membership billing through the website is dropped, or if the Show becomes an
annual event instead of every three years.

---

## The two that stayed in

### PayFast — the one we're recommending to keep

**What it is:** The payment system SAOC already uses. A shopper pays by card, EFT, or a few
other methods, and the money eventually lands in SAOC's bank account.

**Why it's still in:** Three reasons. First, it's already built into the ticket system and has
been checked for security — ripping it out and starting again weeks before ticket sales open is
a real risk for an uncertain reward. Second, it's the only one of the six we looked at that can
do both one-off ticket sales *and* ongoing membership billing through one relationship — useful
if SAOC starts selling society memberships online, which is planned but not yet locked in.
Third, PayFast has a proper sign-up path for non-profits.

**Confidence:** High. This is our own working integration, and the pricing and refund process
came from PayFast's own documentation. One serious gap remains open: PayFast's contract lets
them hold onto sale money for up to 540 days (about 18 months) in some circumstances, and we
have not yet gotten a written promise from PayFast that this won't be used against a ticket
sale. That has to be resolved before sales open.

**If circumstances changed:** If memberships are dropped from the plan, PayFast loses its biggest
advantage over Ozow (recurring billing), and the cost gap (PayFast is consistently more
expensive than Ozow) starts to matter more.

### Ozow — added as a second, cheaper option

**What it is:** A newer South African payment system built around paying straight from your bank
account rather than a card, which makes it noticeably cheaper.

**Why it's in, with caveats:** It's meaningfully cheaper than PayFast on every payment method we
checked — roughly R8 less per R500 ticket. Its refund product is genuinely well built. But we
could not find or read Ozow's actual merchant contract before writing this, so we don't know
what its money-holding rules are. We also don't have a confirmed sign-up path for a body like
SAOC (a national council, not a company or an individual).

**Confidence:** Medium. The pricing is confirmed straight from Ozow's own published price list —
that part is solid. The unresolved parts (the contract, the sign-up path, three conflicting
statements about when money actually arrives in the bank) are open questions we're sending to
Ozow directly, not settled facts.

**If circumstances changed:** Ozow only supports recurring billing for Capitec account holders.
If memberships become important and most members don't bank with Capitec, Ozow can't carry that
load on its own.

---

## Yoco — a more complicated story than the original paper let on

**What it is:** A well-known South African card-payment company, popular with small businesses
and increasingly used for events.

**Why it was ruled out — and why that reasoning needs a correction:** Yoco was excluded for two
reasons. The first is solid: **Yoco cannot do recurring billing at all.** Yoco's own
documentation says so plainly. If SAOC wants to bill memberships automatically, Yoco simply
can't do it — full stop, no caveat.

The second reason is where we owe the Council an honest correction. We also ruled Yoco out
because its refunds come out of a "pending" balance that Yoco holds day to day — and since SAOC
only sells tickets in a short burst every three years and then takes in no money for months, a
refund request arriving weeks later could hit an empty balance. **We treated this as
disqualifying for Yoco.** But after reading PayFast's and Ozow's actual contracts more closely,
we found **both of them have the exact same constraint.** PayFast's contract (clause 11.10) lets
them refuse a refund until SAOC deposits the money to cover it. Ozow's refund product only works
if its "float" — money held ready for refunds — isn't empty. We treated this problem as fatal
for Yoco and as a manageable footnote for the other two, in the same document. That's
inconsistent, and it happened because we'd read Yoco's public help pages carefully but hadn't
yet read the PayFast and Ozow contracts when we wrote the Yoco section.

Looked at fairly, side by side, Yoco actually has real strengths the first draft underplayed: it
has an explicit sign-up path for non-profits (a chairperson, treasurer or secretary can register
it, with a dedicated guide for non-profit paperwork), event ticketing isn't on its list of
banned business types, and its refund system (webhook notifications, protection against double
refunds) is better engineered than PayFast's. Genuine differences that remain, and count against
it: refunds are hard-capped at 90 days after purchase, and a refund on a debit card only works
on the same day it was charged.

**Confidence:** The "no recurring billing" reason is high-confidence — it's stated directly by
Yoco. The "empty balance" reason is real but was applied unfairly relative to the other two
providers; the underlying problem is real for all three, not unique to Yoco.

**If circumstances changed:** If memberships are dropped entirely, Yoco's disqualifying flaw
disappears, and it becomes a genuinely competitive option worth a proper side-by-side look
against PayFast and Ozow — not a dismissed one.

---

## Peach Payments and Paystack — never properly checked, and we should say so plainly

**What they are:** Two more South African payment processors. Peach is aimed more at larger
businesses; Paystack operates here but is owned by Stripe (a big American payments company) —
though the Council would be dealing with Paystack directly, not Stripe.

**Why they weren't chosen:** Honestly — not because we found a disqualifying problem, but
because we ran out of research time before checking the two things that matter most for SAOC:
whether either can do recurring membership billing, and whether either has a proper sign-up path
for a non-profit. Neither was confirmed one way or the other. Peach's refund system, from what
we did check, looks like the best-engineered of everything we looked at — refunds trigger proper
notifications automatically. Paystack's refund documentation was the most complete and clear of
any provider reviewed.

**Confidence: this is the important part — low, on purpose.** We are not saying these are bad
options. We are saying we did not do the work to know. Calling this "ruled out" would overstate
what happened. The honest label is "not yet researched enough to decide" — both deserve a proper
look if the Council wants a genuine three-way comparison instead of a two-horse race.

**If circumstances changed:** Not applicable — nothing has been established well enough yet to
say what would or wouldn't hold up.

---

## Ruled out for solid, checkable reasons

### Adumo

**What it is:** A South African payment gateway aimed at mid-size and larger businesses.

**Why it's out:** You can't see its pricing without booking a sales call — no public price list
at all. Worse, its own support documentation says refunds are actually carried out by the
merchant's own bank, not by Adumo itself, adding an extra party and extra delay to every refund.

**Confidence:** High — both facts came directly from Adumo's own published materials.

**If circumstances changed:** No plausible change to SAOC's plans fixes either problem — both
are structural to how Adumo works.

### DPO Pay / PayGate — not really a separate choice at all

**What it is:** Another gateway brand, often mentioned as a PayFast alternative.

**Why it's out:** It isn't actually a different company. PayFast, PayGate and a related payment
service (SiD Secure EFT) were all part of DPO Group. Network International bought all of DPO
Group outright in October 2021. Then, in September 2024, Brookfield Asset Management — a large
Canadian investment firm — bought Network International itself for £2.2 billion, which is why
PayFast now advertises itself as "Payfast by Network." **We checked this ownership chain
independently against news coverage of both deals, and it holds up.** Practically, this means
choosing PayGate as a "second option" alongside PayFast doesn't actually spread SAOC's risk
across two different companies — it's the same corporate parent both times. PayGate is really a
different product built for businesses that already have their own bank merchant account, not a
genuine independent alternative for SAOC.

**Confidence:** High — the ownership history is independently confirmed by multiple news
sources, not just the companies' own claims.

**If circumstances changed:** This doesn't change with SAOC's plans — it's a fact about company
ownership, not about ticket volume or membership billing.

### Stripe

**What it is:** One of the world's biggest online payment companies.

**Why it's out:** Stripe does not support South African businesses signing up directly. We
confirmed this because Stripe told a prospective South African merchant this directly. Not
usable, full stop.

**Confidence:** High.

**If circumstances changed:** No change to SAOC's circumstances affects this — it's a rule
Stripe applies to South African businesses generally.

### PayPal

**What it is:** A very widely known international payment service.

**Why it's out:** PayPal cannot hold or pay out South African Rand. Money would have to sit in
a foreign currency and be converted, adding cost and complexity that doesn't fit how SAOC takes
in and spends money.

**Confidence:** High.

**If circumstances changed:** Doesn't change — this is a structural limit of how PayPal operates
in South Africa, not something specific to SAOC's current plans.

### The four bank direct-merchant options (FNB, Standard Bank, Absa, Nedbank)

**What they are:** Signing up directly with a bank for card processing, rather than going
through an independent payment company.

**Why they're out:** All four require an ongoing business-banking relationship, and none publish
pricing — you only find out the cost after a sales conversation. That setup suits a business
taking payments every week, not a Council that runs one Show every three years. The shape
doesn't fit.

**Confidence:** High on the general pattern (this is publicly how bank merchant accounts work in
South Africa); we did not individually price each of the four banks, since the "no public
pricing, ongoing relationship required" pattern was enough to rule the category out.

**If circumstances changed:** If the Show became an annual event with steady year-round ticket
and membership activity, this category would be worth a second look — the "wrong shape for
occasional use" objection would weaken.

### BNPL providers (PayFlex, PayJustNow, Mobicred as a "pay later" plan)

**What they are:** "Buy now, pay later" services that let a buyer split a payment into
instalments.

**Why they're out:** Two reasons. At SAOC's ticket prices (roughly R150–R1500), the extra fees
these services charge aren't justified by what they offer. More seriously, PayJustNow's own
terms say that if SAOC refunds someone directly — say, handing back cash at the door — the buyer
still owes every instalment to PayJustNow. A volunteer trying to be helpful at the Show could
accidentally leave a member on the hook for a ticket that was already refunded.

**Confidence:** High — the refund trap is stated directly in PayJustNow's own published terms.

**If circumstances changed:** The fee argument might soften if ticket prices rose substantially,
but the refund trap is a structural risk regardless of price, so BNPL stays a poor fit either
way.

---

## In short

- **PayFast and Ozow** are the two live candidates, for solid, well-sourced reasons — with one
  open contract question on each (PayFast's 540-day hold; Ozow's unseen merchant contract).
- **Yoco** was excluded partly on a double standard we've now corrected here. Its one genuine
  disqualifier is no recurring billing; everything else is a closer call than the original
  research suggested, and worth revisiting if memberships come off the table.
- **Peach and Paystack** were never properly investigated — say that plainly, don't dress it up.
- **Adumo, PayGate, Stripe, PayPal, the four banks, and BNPL** were ruled out on solid,
  independently checkable grounds, and none of those reasons look likely to change under
  plausible shifts in SAOC's plans.
