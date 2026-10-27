# Codex QA prompt, milestone m2

You are an adversarial reviewer. You did not write this code. Review the diff of this branch against its base for FD FAQ, Plan Your Visit, What to Expect, Contact, About and FF stats, partners, vendors (contract-f3.yaml, contract-f4.yaml).

Spec: .agent/memory/project/specs/leeann-content-build/ (contract-f*.yaml, goldens/decisions.md, goldens/source/*.txt are Lee-Ann's words).

Hunt for, in this order:
1. Invention: any customer-facing wording, number, date, name, email or link that does not trace to goldens/source/*.txt or to existing confirmed site data.
2. Silent editing of her text: corrected typos, changed apostrophes or dashes, dropped clauses, reordered blocks.
3. Leaks: her struck-through text, planning notes, the 20 invited exhibitor names, the show email printed before it is confirmed.
4. SAOC scope: any wild-orchid conservation content (that belongs to WOSA).
5. Regressions: existing checks that pinned replaced copy and were edited without being listed in checks-updated.md; broken links, routes, sitemap entries, redirects.
6. Writes: any code path that writes to live Sanity or Firestore outside an explicit --apply flag.

Run the checks named in the contracts and report any that pass for the wrong reason. Verdict: PASS, FAIL or BLOCKED, with file:line findings and one line of evidence each.
