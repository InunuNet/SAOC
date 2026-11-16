# NOS Design overnight critique, 2026-10-25 (verbatim relay from NOS Design session)

Overnight full critique of both sites, top 10 by impact, then the full list. 16 SAOC + 22 NOS routes, each probed at 1440 and 390, plus by-eye. Clean everywhere: no horizontal overflow at 390 on either host, one h1 per page, no text under 12px (except the lockup tagline, exempt #71).

## TOP 10
1. HM-1 · P0 class, ruled already: ship the SAOC mirror PR next. Still live: /about orchid-pink and /judging orchid-dark serve 2048 against the 2850 needed at 1440@2. /sponsors, /contact and /media-kit still have a full-wash scrim over the photo. Your re-encode makes the widths available; the mirror PR has to request them and localise the scrim. (Brad P0; audit.md · performance)
2. SV-1 · P1, SAOC /events/19th-south-african-national-orchid-show. The flagship event page is a stub: docH 1014, one link ("← All events"), no route to the show. Change: on a National Show event, put the existing ShowBand (EV-2) under the meta table. Its CTAs use labels already in use: "Tickets" to nos.saoc.co.za/tickets, "National Show" to nos.saoc.co.za. This is the seamless switch Brad asked for. (critique.md · H3 user control, H7 flexibility)
3. SF-1 · P1, SAOC /events/submit. A public form asks for "Host society ID (optional — Sanity document ID)". Change: an optional "Host society" select listing the 21 societies by name, with the doc id as the value. Never expose a CMS id to visitors. (critique.md · H2 match the real world)
4. NX-1 · P1 copy, NOS /exhibitors. The hero lede is internal drafting copy on a public page: "…offered so the show committee has something to correct rather than a blank page. None of it is SAOC policy until the committee says so." It isn't marked placeholder. Change: Lee-Ann doc item. Until she answers, the public build drops those two sentences, keeps the first, and the TBC notice band carries the status. No new copy. (R7; critique.md · H2)
5. NC-1 · P1, NOS /tickets and /programme. The Workshops card plate serves 640 into an 842 device-px box (1.32× upscale). Its sizes says 300px but the box is 421px. Change: sizes="(max-width: 700px) 100vw, 421px" on programme card plates, so the 1080 candidate is picked. Gate: served ≥ box×DPR at 2056@2, 1440@2 and 390@3. (Brad P0 card rule)
6. TG-1 · P1/P2, SAOC standalone targets. Under 24, failing 2.5.8 AA: /societies/[slug] email and phone at 21. Under 44: Facebook, Instagram and the society website at 25; home "Full calendar →" 24; event "← All events" 24; /contact info@ 24; /societies search 41; /events/submit inputs 38–39. Change: standalone links become inline-flex with min-height 44 (no visual size change). Inputs get height 44. Inline links in prose stay exempt. (audit.md · target size)
7. NV-1 · P2, NOS header. /vendors/apply drops "Past shows": 5 items against 6 on every other route. The 404 shot shows the same. Change: one nav source for every route, including not-found. Same items, same order, or the bar jumps between pages. (critique.md · H4 consistency)
8. AR-1 · P2, NOS /archive. "Past shows" sits in the primary nav but the page is one TBC card ("Show history awaiting committee records"). Change: the EV-6 rule. In public mode with no records, omit /archive from the nav and sub-nav. It returns automatically when records exist. Do it in the same nav source as NV-1. (critique.md · H8)
9. SF-2 · P2, SAOC /events/submit is off-system. The h1 is a bold sans; every other SAOC h1 is Crimson Pro 300. The inputs are 38. The submit button is navy where the SAOC primary is the sand "Join a society" token. There's no page hero. Change: the /contact form pattern (h1, field labels, 44 fields, primary token). Same PR as SF-1. (critique.md · H4)
10. SP-1 · P2 plus content, NOS /symposium. The Michael Tibbs portrait's original upload is 201×317. The builder requests w=261, upscaling the source itself, into a 320 device-px box. Change: the Sanity URL builder caps w at the asset's original width (fit=max) with a 1x/2x srcset. Lee-Ann doc: a portrait of at least 320×400. (Brad P0)

## FULL LIST (the rest)
11. SV-2 · P2, SAOC event detail: "← ALL EVENTS" and the "SHOW" chip touch (0px; back link right = chip left = 435.4). Change: the chip moves to its own line above the h1 with a 16px gap, and the back link gets min-height 44 (that's TG-1).
12. SG-1 · P3, both sites: the header jumps about 6px between short pages (no scrollbar) and long ones, e.g. /events/19th against /events/submit. Change: html { scrollbar-gutter: stable } on both hosts. Part of the seamless switch.
13. NOS placeholder copy: 6 routes still render AI placeholder blocks in preview (/international-guests, /programme, /sa-exhibitors, /sponsors, /symposium, /wosa-conference). Content count for the Lee-Ann doc, not a design ruling; it's preview chrome.
14. LT-1, ruled already, still unshipped: NOS serif h2s at 48/400 (hub, /archive, /what-to-expect, /conferences 39/400) should be 300.
15. FAQ group h2s at 12px caps sit under 22px question rows, an inverted hierarchy. Covered by FQ1 (32/300 section headings), no new ruling.
16. /tickets crumb at 43 and the WOSA heading link at 36 are inline-exempt (as ruled 10-19). No change.

## Routing (NOS Design, amended by SAOC/NOS Site agreement 2026-10-25)
- SAOC polish wave: 2, 3, 6, 7, 8, 9, 11, 12 (both hosts).
- NOS Site: 1 (HM-1 mirror), 4, 5, 10 (as nos-sweep-fixes), 14 (LT-1).
- Lee-Ann doc: 4, 10, 13 (posted as uuu, vvv, www).
