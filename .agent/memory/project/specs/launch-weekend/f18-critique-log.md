# F18 critique log

Method: impeccable critique (craft-floor, polish) applied inline. The impeccable launcher binary is not installed, so `impeccable context` did not run; PRODUCT/DESIGN context was read directly and the heuristic scoring was done by hand against the full-page screenshots at 390 and 1280 on the 12 A11 routes (about, what-to-expect, vendors, sa-exhibitors, exhibitors, programme, wosa-conference, international-guests, faq, workshops, conferences, archive). This is a degraded method and is recorded as such.

## Pass 1

Shots: `.tmp/sandbox/lw-f18/after/{390,1280}-*.png`, public build.

Findings:
- P1: /faq lede (Sanity faqIntro) says unconfirmed answers "are marked as such" while the public build hides the marks. The claim is false on the page.
- P2: about and vendors long-form body paragraphs ran together with no vertical gap (a `margin: 0` on `.nos-longform-body > p` out-ranked the `> * + *` rhythm rule).
- P2: at 390 the FAQ "To be confirmed" chip wrapped to three lines and sat taller than the row rhythm allows.

P0: 0
P1: 1
P2: 2
Score: 33/40

## Pass 2

Fixes: faq lede dropped in public mode; paragraph margin rule removed so the 24px rhythm applies; chip line-height and block padding tightened inside the FAQ row. Rebuilt the public build, re-ran A1, A2, A3, A5, A7, re-shot all 24 images at 390 and 1280, and re-read about, programme, faq, vendors, sa-exhibitors and archive.

Findings: none. Holding pages show facts, sibling cards and the "Be the first to know" band; long-form pages show the facts aside, one image break and the Tickets / Plan your visit pair; the archive card spans the column; the hub keeps no index.

P0: 0
P1: 0
P2: 0
Score: 37/40

## Pass 3 (F18b keepsake tickets)

Method: impeccable critique (craft-floor, polish) applied inline, same degraded method as above (no launcher binary). Shots: `.tmp/sandbox/lw-f18/after/{390,701,960,1280,1920}-{tickets,conferences,workshops,day-visitor}.png`, public build on port 3682. Detail in `f18b-critique-log.md`.

Findings:
- P1: checkout hero was 380px high (inner-hero min-height) and the first quantity control sat at y=894 at 1280.
- P1: bare /tickets answered 200 with a meta refresh (a route-level loading boundary flushed the shell before the redirect).
- P2: ticket CTA 53px high (inherited line-height), want 50.
- P2: 390 hero fan cells changed height during the fan-out transition (layout shift).
- P2: ticket sections used 64/0 padding where the site rhythm is 72/72 and the masthead carried no hero hooks.

P0: 0
P1: 2
P2: 3
Score: 31/40

## Pass 4 (F18b keepsake tickets)

Fixes: compact hero on /tickets/[slug] (min-height 0, tighter padding), description kept for assistive tech only on a single-type screen; loading.tsx moved into [slug]/ so /tickets is a 308; button line-height 1; fan-out disabled on the phone deck; section padding symmetric at the site rhythm; masthead carries data-nos-hero="inner" / variant "fan". Rebuilt, re-shot all ticket routes at 390, 701, 960, 1280, 1920 and re-read the hub, conferences, workshops and checkout.

Findings: none open. Hub: masthead fan, three titled sections, early-bird pool banner only with real stock, foot cards, index. Checkout: compact hero, card, per-day steppers, one Total beside Buy.

P0: 0
P1: 0
P2: 0
Score: 37/40
