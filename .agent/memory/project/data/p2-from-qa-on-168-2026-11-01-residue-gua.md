# p2-from-qa-on-168-2026-11-01-residue-gua

**[P2, from QA on #168 2026-11-01] Residue-guard quota skip has no escalation:** a long Sanity outage leaves CI green with no scan done (by design: exit 0 + ::warning::). Visibility today = the hc.sh Sanity-quota probe (twice daily). Follow-up: count consecutive SKIPPED days in a workflow artifact and fail on day 3, or post to comms.md.
