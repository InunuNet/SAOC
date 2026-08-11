# Call prep — Lee-Ann McCleland (Spec V1/V2 vs proposal)

**Status: living document.** Keep adding questions/ideas under "Log — new items" at the bottom as they come up; the rest of the doc will get reorganised into it before the call.

**Purpose:** reconcile Lee-Ann's Website Development Specification (V1 12 Jul, V2 15 Jul) against our 28 May proposal, and go into the call with a clear, complete list of what needs deciding — not just the sequencing point already covered in the drafted email.

**Sources used — verified against the actual sent emails, not memory (2026-07-23 re-check):**
- **The actual proposal Lee-Ann received:** `SAOC_Website_Proposal_28-05-2026.pdf`, emailed 28 May 2026 to `saoctreasurer@gmail.com` (one of Lee-Ann's other addresses — not `2027national@gmail.com`). Downloaded from that sent email and diffed word-for-word against `documents/SAOC_Website_Proposal_28-05-2026.docx` on disk: **content is identical**, only PDF letterhead/page-footer differs. The docx on disk is confirmed to be what she actually got.
- `documents/Website Development SpecificationV1.docx` — Lee-Ann's spec V1
- Website Development Specification**V2**.docx (Google Drive, Lee-Ann's copy, 15 Jul) — not yet saved locally, referenced from the live doc
- Gmail draft "SAOC website — how I'd sequence the build" (id `r7069159880970212600`, unsent — sequencing content now superseded by the fuller mapping in this doc and the artifact below)
- Brad's actual **sent** formal reply to the Secretary's question list, 3 Jul 2026 (thread `19f177b373bd9f35`, to `2027national@gmail.com`) — this is where the Yoco→PayFast switch was already communicated in writing (see B1).
- `.agent/memory/project/needs-human.md` and `backlog.md` — decision matrix + branding items already logged
- **Full phase-by-phase comparison, built from these sources:** https://claude.ai/code/artifact/eb888f16-a4e8-42c7-9a1e-0c595fc85326 — every page in Spec V2, mapped to Phase 1 / Phase 2 / needs-a-decision, with the reasoning for each.

---

## A. Sequencing — already decided, opens the call

This is the position the drafted email lays out. Restating it here so it's the spine of the call, not just an email Lee-Ann reads alone. Full page-by-page mapping is in the artifact linked above — this is the summary:

1. Lock the design direction first — nothing else moves until visual identity is signed off.
2. Core SAOC site (the 8 pages actually priced: Home, About, Societies, Judging, Judges Training, Events, Sponsors, Contact) + a Show "marker" landing page live — General Admission ticketing included, plus small Spec V2 polish items absorbed at no cost (About's document library, calendar filtering, FAQ as its own static page, category-routed Contact form).
3. Ticket sales open off that same marker page, not after the full Show site is built — so sales start as early as possible toward selling out by early 2027.
4. Everything else deferred to a separately-scoped, separately-quoted Phase 2, once Phase 1 is live and the committee is actively marketing:
   - Shared relational content database (Spec V2 Section 7 — Exhibitors, Speakers, Sponsors, Judges, Awards, Workshops, Societies, News, all cross-referenced)
   - Unified multi-category booking + waitlists (General Admission, Symposium, WOSA, Workshops in one checkout)
   - Members Portal + digital journal archive + full searchable awards archive
   - Symposium / WOSA Conference / Workshops / SA & International Exhibitor directories / Programme / Plant Sales / Plan Your Visit — 12 of the 18 National Show pages in Spec V2 depend on the shared database above

Worth being direct about the scale gap in the call: Spec V2 is really **two websites** — a 6-page SAOC organisational site and an 18-page National Show event site with a full relational database behind it — where the actually-sent proposal priced 8 pages + 1 landing page + simple General Admission ticketing. That's not a scope tweak, it's a different-sized project for the deferred pieces.

---

## B. Open questions / things to clarify on the call

### B1. Payment gateway — Yoco → PayFast — ALREADY RESOLVED, don't re-raise as new
Correction to the earlier version of this doc: this is **not an open item**. The proposal document names Yoco throughout, but Brad's actual sent reply to the Secretary's formal question list (3 Jul 2026, to `2027national@gmail.com`) already told her directly: Yoco is waitlisted with no ETA, and PayFast is the recommendation — including the exact fee structure (3.2% + R2 per card transaction, 2.0% on Instant EFT) and the FICA documents SAOC needs to gather for a live PayFast account. Lee-Ann acknowledged receipt and said the committee would discuss and revert. No need to re-explain this on the call — just worth a quick "did the committee land anywhere on that?" to close the loop, since no reply has come back yet.

### B2. CMS — Sanity Studio status update, not a correction
Correction to the earlier version of this doc: Sanity Studio *was* part of the stack from the start (confirmed by Brad, 2026-07-20) — this doc previously flagged it as a mismatch based on `CLAUDE.md`, which is stale on this point and doesn't mention Sanity at all. The repo confirms Sanity is real and substantially built: full schema set (society, event, nationalShow, sponsor, judge, boardMember, etc.), the `/studio` route, client/fetch libs, and a seed script.

Current state per Brad: Studio is set up with API keys and "almost working," but **documents aren't editable yet** — root cause not yet diagnosed. This is a live technical blocker worth surfacing on the call only if it affects the Phase 1 timeline commitment to Lee-Ann (i.e. don't raise it as a scope question — it's an internal build issue to fix, not something for the committee to decide).

### B3. Ticket pricing and capacity — actively blocking the build
The PayFast ticketing work (mission `payfast-ticketing`) is paused at the point where it needs **real numbers**: adult/pensioner/child/member/exhibitor ticket prices and capacity limits. This is the single most concrete, time-sensitive ask for the call — without it, ticket sales can't go live even once the marker page is up.

### B4. Content-gathering ownership and timeline
Spec V2's Appendix is a long content checklist (director photos, SAOC history write-up, incorporation/NPO documents, society directory data, judges' handbook, etc.) for Phase 1 pages alone. **Ask:** who on the committee owns pulling this together, and by when — the 6-week Phase 1 timeline assumes content lands promptly, and several items (e.g. the Shane Burns history write-up) are outside our control.

### B5. One codebase, two "sites"
Spec V2 frames the SAOC site and National Show site as two separate websites. Structurally we're building this as one Next.js app with route groups (SAOC pages + a `/national-show` section) rather than two separate builds — same effect for visitors, much cheaper to build and maintain. **Ask:** confirm this is fine, i.e. the "two websites" language in her spec is about visitor experience, not a requirement for two separate codebases/domains.

### B6. POPIA responsibility — DEFERRED (Brad, 2026-08-11), do not raise on the call
**Back burner.** Not a Phase 1 blocker and not worth committee time right now. Revisit before launch, when real personal data (elected officials, exhibitors, members) is actually about to go live — that is the point where consent genuinely matters. Original framing below.

Spec V2 raises elected-official names/contact info per society, exhibitor contact details, and general POPIA consent wording throughout, and notes SAOC "did do a roll out of POPIA in 2024 but we probably need to do this again." **Ask:** who owns confirming what personal data each society/exhibitor/member has actually consented to display — that's a Council governance question, not something we can determine on their behalf.

---

## C. Branding

### C1. SAOC organisational brand — IN PROGRESS with Brad (2026-08-11)
Distinct from the National Show identity. Lee-Ann's 14 Jul email said "Scott will also help me with the design for SAOC and we will get this to you asap." **Superseded 2026-08-11: Brad is designing the SAOC organisational logo himself, in progress now.** No longer an ask for Lee-Ann or a wait on Scott — it becomes a *presentation* item on the call once done. Still upstream of "lock the design direction" (step 1 of the sequencing plan), but the blocker is now internal and time-boxed rather than external and open-ended.

### C2. National Show brand model — per-edition redesign vs stable master brand
Brad's working hypothesis, not yet raised with anyone: the National Show's identity looks like it gets redesigned from scratch each host cycle (the current logo is explicitly "WESTERN CAPE 2027," tied to this edition's host region and its committee-chosen *Disa graminifolia* emblem). Proposed alternative to float: a stable National Show master brand that persists across editions, with a rotating "host sub-brand" layer that changes per edition (Cape Town, Stellenbosch, Johannesburg, KwaZulu-Natal, etc.). Worth asking the committee directly whether this has ever been discussed, or whether full-redesign-per-edition is intentional.

### C3. Show assets — RESOLVED 2026-08-11: permission granted, new Show logo designed
**Scott has given permission to edit, change and redo the logo assets.** The "is this locked?" question below is answered — it is not locked, and the process ask no longer needs raising. A **new National Show logo has been designed** (asset work in `branding/Logo Disa Graminifolia/` and `branding/Logo Options Rev 1/` — the final selected file is not yet identified in the repo). Remaining call item is presentational: show the committee the new Show identity, not ask permission for it.

_Original framing, retained for context:_

The logo, colours (`A7A841`, `7F7D33`, `211A57`, `F3F2D6`) and font shortlist (Montserrat + three DaFont display options, none chosen yet) came through informally via Scott's emails, not as a ratified design guide. Since "lock the design direction" blocks everything else, worth confirming: are these final, or still open for committee sign-off?

Brad's view (2026-07-23): the current designs feel a little lacking for what a national-level event brand needs, and a proper design pass through Claude Design could produce something noticeably stronger. **Ask directly:** is the committee treating Scott's work as locked, or is there appetite to revisit it with a more considered design process before it's locked in? Frame this as an offer, not a critique of Scott's effort — he's a volunteer, and the ask is about process (a structured design guide vs. ad hoc email attachments) rather than his work specifically. (A brand reference doc has been assembled from what's been sent, ready to hand to a design pass either way: see `branding/national-show-2027/`.)

---

## D. The committee's own questions (Spec V2, Section 8) — worth having answers ready

Spec V2 already lists questions *to* us. Good to walk in with answers rather than re-discover them live:

- Can committee members reorder/manage homepage content blocks without developer help?
- Can content (news, programme, awards, FAQs) be scheduled for future/automatic publication?
- Can individual societies be granted limited CMS access to manage their own Calendar entries?
- Can exhibitors/guests/workshops be filtered by category, country, role, skill level?
- Can one profile (speaker/judge/exhibitor) automatically appear on every page relevant to their role?
- Can visitors book multiple ticket types in a single transaction?
- Can workshop/symposium capacity close automatically with waiting lists?
- Can committee members get notified by email when someone books Symposium/WOSA/a workshop?
- Can award results and WOSA/Symposium proceedings form a permanent, searchable archive for future shows?

Most of these are Phase 2 (shared database + unified booking) territory — worth being upfront that the *capability* exists in the plan, but isn't in Phase 1.

---

## Log — new items

_Add new questions/ideas here as they come up. Nothing below this line has been organised into the sections above yet._

-
