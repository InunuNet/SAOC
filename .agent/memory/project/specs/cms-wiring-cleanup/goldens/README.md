# Goldens — cms-wiring-cleanup

Reference state for `contracts/contract-cms-wiring-cleanup.yaml`. Where an implementation
and a golden disagree, the golden is right.

| File | What it fixes in place |
|---|---|
| `wire-vs-remove.golden.md` | The decision record: for each orphaned type and dead field, wire or remove, with the reasoning and the live-emptiness evidence that permits each removal. Also defines what "wired" and "removed" have to mean. |
| `archive-show-merge.golden.md` | How a national show is assembled from the static array and the Sanity `show` document — the per-field precedence rule, the explicit mappings, and how a Sanity-only year must degrade. |
| `province-chip-order.golden.json` | The exact `/societies` filter-chip sequence, captured from the live page before any change, plus the `order` values to seed and the province names to use as aria-labels. Read directly by `check-province-chip-order.mjs`. |

## How the checks are graded

All checks live in `contracts/checks/cms-wiring-cleanup/` and run from the repo root
against the shared dev server at `http://localhost:3333` (override with
`SAOC_CHECK_BASE_URL`). This session has no live domain, so nothing here is graded
against the deployed site.

Four checks MUTATE the real Sanity dataset (A1, A3, A5, and no others). Each captures the
exact prior value, restores it in a `finally`, and verifies restoration against both the
dataset and the rendered page. If restoration cannot be PROVEN, the check exits **90**
with a RESIDUE ALERT banner rather than an ordinary failure — treat that as "test content
may still be live, check manually", not as "assertion failed". Sentinels are formatted
`ZZCHECK-<TAG>-<base36 timestamp>` so any residue is greppable in the dataset and in
rendered HTML.

Poll budgets are 90s (propagation) and 120s (cleanup) because `sanity/lib/client.ts` sets
`useCdn: true`; propagation was measured live at roughly 60s during authoring. A single
immediate read would produce a false FAIL.
