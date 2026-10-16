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

## Pass 3

Method as above (impeccable critique, inline; launcher binary still missing). Input: design-cb's audit of 47cf7f1b plus the released P2 rulings, taken as this pass's findings, then fixed on `fix/lw-f18a-audit` and re-shot on the public build at 390 and 1280.

Findings:
- P1: R16, the four long-form image breaks reuse stock photos that already head other routes (no unused photo exists).
- P1: /archive shows a facts rail and a two-item mini list that duplicate the Explore index.
- P1: /sa-exhibitors repeats the h1 as the first h2.
- P1: /vendors hero lede promises nurseries while none are confirmed.
- P2: /workshops transfer note is 13px muted.
- P2: /faq question cards are 138px tall for one line (an own regression: un-scoping the FAQ rules lowered `.nos-faq-item` below `.nos-theme .nos-surface`, so 32px of padding came back).
- P2: /about hero has no lede, unlike every other long-form hero.

P0: 0
P1: 4
P2: 3
Score: 31/40

## Pass 4

Fixes (commits eb98149f, 5747651b, f738b500, 468d3139, 0b8f27e9): breaks dropped; archive shows the single committee-records card; the h2 is skipped when it equals the h1; the vendors lede is hidden while empty in public; terms note 14px/1.55 ink-700; FAQ card 66px for one line with the 44px+ summary as hit area and the gap kept; the about hero stays h1-only (design-cb ruling b: no lede, no empty node, no reserved spacing).

Re-shot all 12 routes at 390 and 1280 on the rebuilt public build and re-read archive, vendors, sa-exhibitors, about and what-to-expect at both widths, plus faq and workshops at 1280. No new defect on the five routes: hierarchy is one h1, then the lede, then the facts aside beside the body; the archive card is a single quiet block above the Explore index; the sa-exhibitors body starts straight under the sub-nav without a repeated heading.

Outside F18 scope, recorded for the lead: the Sanity logistics block on /what-to-expect still shows "To be confirmed by the show committee" chips in the public build; the F18 spec lists it as untouched.

P0: 0
P1: 0
P2: 0
Score: 39/40
