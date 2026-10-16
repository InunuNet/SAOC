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
