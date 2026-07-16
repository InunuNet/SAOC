
## PayFast Sandbox credentials (2026-07-03)
Needed to test the D2/D4 PayFast checkout integration end-to-end. Free signup, no FICA required for sandbox:
1. Sign up at sandbox.payfast.co.za (or registration.payfast.io, select sandbox/test mode)
2. Get Merchant ID, Merchant Key, set a Passphrase
3. Add to .env.local as PAYFAST_SANDBOX_MERCHANT_ID / PAYFAST_SANDBOX_MERCHANT_KEY / PAYFAST_SANDBOX_PASSPHRASE
Blocks: live checkout testing against PayFast's sandbox API. Does NOT block schema rework, spec, or UI scaffolding.

## Real 2027 Show ticket pricing (2026-07-03, non-blocking)
Adult/Pensioner/Child/Member/Exhibitor tier prices and capacity not yet confirmed by Brad. Building against proposal's tier names with placeholder prices in the meantime, clearly flagged as placeholders.
**Possible lead (2026-07-15):** Caral-Anne van der Westhuizen referenced an Excel spreadsheet ("2nd tab with dropdown menus") covering cocktail-party and other ticket options during the Spec V2 tracked-changes review; Lee-Ann confirmed full ticket write-up/pricing still needs to come from the committee. Worth asking Lee-Ann for that spreadsheet directly rather than waiting for it to be rewritten.

## Scope reconciliation: Spec V2 vs signed Phase 1 proposal (2026-07-15)
Built a full comparison (artifact, not committed to repo) of Lee-Ann's Website Development Specification V1/V2 against our signed 28-May proposal (R12,375 ex VAT, 8 pages + 1 Show landing page + simple 5-tier Yoco ticketing). Finding: most of what we quoted as separately-priced "Future Phases" (Membership + journal archive) now reads as core/confirmed scope in her spec, and an entire event-conference layer (Symposium, WOSA Conference, Workshops, SA/international exhibitor+guest databases, Plant Sales, Programme, Plan Your Visit, FAQ — 18 National Show pages total) was never quoted at any phase. **Needs a conversation with Lee-Ann before more National Show build effort goes in** — either the committee intends Spec V2 as a repriced/rescoped Phase 1, or it's a north-star roadmap to be delivered in the same staged, separately-quoted way the proposal described. Brad has not yet decided how to raise this.

## Sanity project downgraded to Free plan (2026-07-14, noticed in passing)
Email from Sanity.io: SAOC's Growth trial ended, project auto-downgraded to Free plan. Not yet assessed whether Free-plan limits (API CDN requests, dataset size, seats) affect the current build or CI's llms-full.txt refresh cron. Needs a look — flagging so it doesn't get lost.

## PayFast M1 spec — security review deferred (2026-07-03, late Friday)
Brad approved proceeding to @dev without a detailed walkthrough right now (tired, end of week).
Spec itself is sound (server-derived pricing, fail-closed ITN validation, contract-gated signature).
Revisit later: the architect's flagged [VERIFY] items once @dev confirms them against real PayFast
docs — signature field ordering, PHP urlencode vs JS encodeURIComponent, ITN source-IP list,
server-confirm callback path. Not blocking build, just worth a real look once it's implemented.
