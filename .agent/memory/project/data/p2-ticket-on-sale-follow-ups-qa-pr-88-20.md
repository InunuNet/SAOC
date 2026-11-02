# p2-ticket-on-sale-follow-ups-qa-pr-88-20

**[P2] Ticket on-sale follow-ups (QA, PR #88, 2026-10-25):** (a) contract-f1.yaml A7 is vacuous (`$p` expands inside double-quoted sed; the leading `!` always exits 0), so escape it as `\$p`; (b) the hub and JSON-LD do not filter wrong-show tickets (buildHubCards ignores activeShowId; the hub query does not select `show`); (c) a refused /tickets/[slug] renders a hero with no notice, which needs sourced copy.
