# 2026-10-26-false-positives-in-contracts

(2026-10-26) False positives in contracts/checks/policy-pages/check-refunds-no-fabrication.mjs ("20%", from %20 in the og:image URL) and check-refunds-provisional-figures.mjs ("300%", from the skip link's -translate-y-[300%] class). Both scan raw HTML, including attributes. Confirmed failing on main's beta /refunds too. Fix: scan text content only.
