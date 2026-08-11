# Orchid-show exhibitor conventions — research reference

_Researched by @analyst (EXH-RESEARCH) via Alembic, 2026-08-11. Designated input for F1 of
mission `show-exhibitor-info` (`.agent/memory/project/missions/2026-08-11-show-exhibitor-info.md`)._

**How to use this file.** Section 2 is near-universal convention seen across four or more
independent shows — seed those as defaults. Section 3 varies by organisation — do NOT seed those
as SAOC policy; surface them as questions for the committee. Section 5 is SA-specific divergence
where international practice may not transfer.

**Sources:** sforchid.com, ncos.us, sborchidshow.com, sunsetrotary.org, aos.org (Judging FAQ;
Guide to a Successful Orchid Show), osgb.org.uk, oswp.org, hsoc.org.au, orchidsaustralia.com.au
(AOC judging handbook), oscov.asn.au, qos.org.au, anos.org.au, ossea.org.sg, tios.tw,
witsorchid.co.za, CITES / SAFLII / CapeNature.

---

## 1. What we already have — the gap is total

- `app/(marketing)/national-show/exhibitors/page.tsx` (108 lines): static hero, four hardcoded
  blocks (Who can exhibit / Entry categories / Setup and staging / Judging), one paragraph of
  placeholder prose each, plus a "Coming soon 2026" CTA. No deadlines, fees, plant-condition
  rules, display rules, sales policy, insurance, security, watering, CITES or labelling detail.
  A page shell, not content.
- `sanity/schemas/documents/nationalShow.ts`: one relevant field, `exhibitorStages` — a generic
  `portableText` blob with no structure. No entry-deadline, fee, class-schedule, staging-time,
  plant-condition or display-rule fields exist. Today an editor can only paste one blob of text.

## 2. Near-universal conventions — seed these as defaults

1. **Entry and registration.** Plants registered under an Exhibitor Number tied to genus/class.
   Entries close ahead of the show (days to weeks; some shows also run an on-site same-day
   cutoff). A printed/PDF **Show Schedule** lists every class an exhibitor must choose from.
   Classification is explicitly **the exhibitor's responsibility** (AOS Guide) — the committee or
   judges may reclassify or disqualify a wrongly-entered plant.
   _Seen: AOS-affiliate shows (SBIOS, OSWP), OSGB, Australian club shows._
2. **Staging, delivery and removal.** Plants delivered and benched in a fixed pre-open window
   (commonly the day or evening before, sometimes two days). Hall closed to the public during
   staging. **Plants must stay benched for the full show duration — early removal barred or
   strongly discouraged.**
   _Seen: HSOC Canberra ("staged by 10am… open for staging until 10pm Friday"), QOS ("entries
   accepted from 2pm, benched by 7pm"), AOS Guide._
3. **Judging.** Happens after staging closes and before public opening. Exhibitors are generally
   **not present** — judges deliberate privately. A "Do Not Judge" opt-out sign is a recognised
   convention. AOS-affiliated shows run two tracks: local ribbon/trophy judging by the host, plus
   optional formal AOS accredited-judge awards with separate registration and fee. OSGB/UK
   equivalent: rosettes 1st–3rd, trophies for members, certificates for non-members.
   _Seen: AOS Judging FAQ, Sunset Rotary, OSGB._
4. **Plant condition and eligibility.** (a) Correct genus/hybrid identification and labelling,
   with parentage for hybrids — a trade name, or genus + "hybrid", is accepted where unregistered
   (OSGB). (b) Pest- and disease-free, subject to inspection, with disqualification or removal if
   not. (c) A minimum **ownership / grown-by-exhibitor duration** — OSGB requires 12 months'
   possession for Section A; AOS ties "grown by the exhibitor" language to cultural awards.
   _Seen: SFOS, Sunset Rotary, OSGB, AOS._
5. **Display and stand classes.** Distinct from individual plant classes. Group and society
   displays are judged separately and often space-capped (OSGB: up to 1m × 2m; ornamental
   material ≤50% of the exhibit). Individual plants inside a society display are **not**
   automatically judged unless separately marked and logged.
6. **Sales.** Consistently kept separate from the competitive judged floor — vendor/trade tables
   occupy a distinct zone with their own registration. No source described commission-based
   consignment; sales are direct vendor-to-public.
   _Seen: Taiwan TIOS market area, SBIOS vendors, "Orchids & More" vendor set-up._

## 3. Varies by organisation — ask the committee, do NOT seed as policy

- **Entry-deadline lead time** ranges from days to a month. No global norm.
- **Fee structure** varies: per-entry vs per-exhibitor vs judging-service fee. AOS separates show
  fee, trophy fee and award fee — not universal outside AOS-affiliated shows.
- **Whether non-members may compete.** OSGB opens its Spring/Autumn shows to non-members but
  restricts monthly table shows to members; AOS judging is explicitly open to non-members at a
  higher fee. A real policy choice for SAOC.

## 4. Recurring but undocumented publicly — flag as gaps, not conventions

Parking and loading access, shuttle logistics (TIOS documents these; most shows don't),
committee/volunteer watering and plant care during the show, and overnight security or custody
arrangements. All are clearly assumed by every show, but none appear in public exhibitor-facing
copy — they most likely live in internal committee documents. Ask SAOC rather than inventing.

## 5. South African precedent and divergence

**Local precedent is thin.** Almost nothing SAOC-specific with concrete exhibitor rules is
online — only confirmation that the National Show rotates provinces every three years
(Witwatersrand Orchid Society), and Facebook event pages for the 2024 (18th, KZN) show with no
indexed rules content. No archived exhibitor schedule or PDF was locatable. **SAOC's own past
national-show exhibitor packs — if they exist as physical or PDF documents held by the council —
are the authoritative local precedent and should be requested directly.** Do not assume
international norms transfer, especially on entry fees and class structure. Provincial society
sites (Cape, Witwatersrand) show only local show culture — useful for tone, not rule precedent.

**CITES — do not overstate.** Verified via CapeNature and the SAFLII CITES Regulations 2010:
CITES applies to **international** import/export/re-export of Appendix-II listed orchid
specimens, **not** to domestic transport of cultivated plants between SA provinces for a national
show. Artificially propagated hybrids of Cattleya, Cymbidium, Dendrobium (phalaenopsis and nobile
types), Oncidium, Phalaenopsis, Vanda and their intergenerics are explicitly exempted from permit
requirements under certain conditions even internationally. **Exhibitor copy must not imply CITES
paperwork is needed to move plants within South Africa.** It is relevant only to a foreign
exhibitor importing plants into SA. Flag for committee confirmation rather than asserting either
way.

**Provincial plant-movement / biosecurity permits:** no regime was found in this pass, but absence
of a search result is not proof of absence. Put it to SAOC as a direct question.

**Scope boundary held.** Nothing found strays into wild-orchid conservation; all sourced material
concerns cultivated and hybrid orchids in judged competitive shows, consistent with SAOC's
in-cultivation mandate. No WOSA-adjacent content to flag.

## 6. Recommended structure for F1

Distinct structured Sanity fields/objects — **not** one portable-text blob — so the committee
fills SA-specific numbers into a proven skeleton instead of inventing structure:

Entry & Registration (deadlines, fees, exhibitor numbers, class-schedule reference) ·
Staging & Removal Times · Schedule of Classes (link or reference, not inline — the landing page
already renders classes) · Judging (process, exhibitor-presence policy, awards and trophies) ·
Plant Condition & Labelling (inspection, ownership duration, nomenclature) · Display & Stand
Rules (space, group vs individual) · Sales Policy · Practicalities (parking, security, care).
