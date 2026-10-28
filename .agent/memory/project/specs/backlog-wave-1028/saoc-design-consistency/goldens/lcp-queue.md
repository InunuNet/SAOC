# F1e: the image-queuing gap and the bounds

`/about` mobile LCP minus FCP: 4379 - 2272 = 2107 ms on F1d (NOS Design / dev), measured again here: 2103 ms on F1d and 1958 to 2473 ms on main. The hero image is the LCP element and its own phases total about 100 ms, so the gap is queuing: the simulated graph starts the image behind the CSS and fonts.

Bounds (goldens/lcp-bounds.json), architect derivation:
- LCP <= 2500 ms on / and /about: the ruled gate, on a local production build and deployed.
- /about LCP - FCP <= 1000 ms. The lower physical limit for the hero after FCP is one RTT (150 ms on the Slow 4G profile) + the 750w AVIF transfer (17.7 KB x 8 / 1.6 Mbps = 89 ms) + decode and paint (about 100 ms): roughly 340 ms when the request starts at HTML parse (hero preload first in head, A7). One further serialized request (a CSS or font hop costs 150 ms RTT plus its transfer, 2 hops about 600 ms) still fits in 1000 ms; a graph that queues the hero behind CSS and fonts is 2000+ ms, as measured. 1000 ms therefore closes the gap without demanding the physical minimum, and leaves room for the +-500 ms local run-to-run spread to be absorbed by the LCP gate, not by this one. If the dev's measured gap is comfortably under 1000 the bound can be tightened later; it is never loosened.
- 750w AVIF <= 25,000 bytes: F1d measured 17,738; 40 percent headroom for encoder revisions (125 ms at 1.6 Mbps). Hero quality is not an LCP lever (Brad's P0): the bound is on bytes at a width, never a reason to lower quality or served pixels.

Never an LCP lever (assertions A12 to A14): lowering hero quality or served px below box x DPR, lazy-loading anything above the fold, a fade on the hero img or the h1.
