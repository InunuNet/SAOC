# p1-2026-10-29-m3-f3-qa-l1-pin-the-buy-pa

[P1] (2026-10-29, M3/F3 QA L1) Pin the buy-path live flags in a gate before ticketing goes live on 1 Dec. Today only ticket-type-lookup.ts is grepped (A8). Dropping `live: true` at app/(nos)/tickets/[slug]/page.tsx:108/109/168 or in loadTicketCardViewModels would stay green. Extend A8 to cover those call sites and add /tickets/[slug] to the cache-headers-probe --spawn no-store list.
