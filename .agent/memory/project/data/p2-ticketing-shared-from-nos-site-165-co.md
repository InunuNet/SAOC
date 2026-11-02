# p2-ticketing-shared-from-nos-site-165-co

**[P2, ticketing shared, from NOS Site #165 Codex 2026-10-29] Confirmation display resolves the order by `m_payment_id ... .limit(1)` (lib/orders.ts:690, getConfirmedOrderForDisplay).** If two orders ever share a gateway reference, one buyer's confirmation page could show another buyer's tickets. Assess whether m_payment_id is guaranteed unique (minted per order?), then either assert uniqueness at write time or resolve by order id. Also dedupe the ~20-line position-filter loop duplicated in #165's getConfirmedOrderByOrderId once #165 merges.
