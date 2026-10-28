# Provenance

`checks/check-nos-anchor-landings.mjs` is a byte-identical copy of SAOC's A13 survey script:

- source: `origin/spec/sponsor-a12-render-fix` at `d8280e06`, path
  `.agent/memory/project/specs/backlog-wave-1028/sponsor-enquiry-both-hosts/checks/check-nos-anchor-landings.mjs`
- sha256 `ba7c95f2e4e74370def555a30374a4dd4ec804c7ccb798e03137e8250214dcaf` (pinned by contract assertion A1; do not edit)
- vendored 2026-10-28 so this gate does not depend on SAOC's branch.

The vendored script is REPORT-ONLY (always exits 0) and surveys six widths (390, 767, 768, 1024, 1440, 2056). `checks/run-a13-8w.mjs` is the gate
wrapper: it derives a runnable copy at run time (never committed, deleted after the run) that (1) surveys the eight widths NOS Design named (adds 779, 780),
(2) counts a sticky bar (height <= 64px) stuck directly under the pinned header as pinned chrome ("plus any pinned sub-nav", NOS Design 2026-10-28), and
ignores sticky elements over 200px tall (the scrolled-off aside card), then parses its rows and fails unless every /faq, /plan-your-visit and /sponsors
landing is 24 +/-2px below the pinned chrome. A row the script itself marks SHORT (page end, cannot scroll that far) is exempt. /tickets rows (under the
committee-testing bar) are printed, not asserted. The derived edits are pinned by exact-string match, so a changed vendored script exits 2 rather than passing silently.
