# Sanity Studio React-peer fix — Golden Files & Implementation Spec

**P0.** Sanity Studio's document edit pane crashes / never renders when clicking into any
document (list panes work fine). Backlog ref: `.agent/memory/project/backlog.md` —
"[P1, ENGINEERING] Sanity Studio: documents not editable — root cause undiagnosed." (root
cause is now diagnosed; this contract is the fix.)

This is a re-occurrence: commit `397de87` ("fix: upgrade sanity to 5.31.1 to resolve Studio
crash on React 19") claimed sanity 5.31.1 "removes that call entirely" — it does not. Verify
yourself before trusting the commit message:

```
grep -n "useEffectEvent" node_modules/sanity/lib/_chunks-es/structureTool.js
```

still shows the import and multiple call sites (`handleInitialValue`, `syncPathFromUrl`,
`focusDivergentPath`, `updateHistoryParams`).

---

## Confirmed root cause

`sanity@5.31.1`'s Structure Tool calls `React.useEffectEvent` — a React ≥19.2.2-only API.
`package.json` currently declares `"react": "^19.0.0"` and `"react-dom": "^19.0.0"` — a range
whose **minimum satisfiable version is 19.0.0**, which does not have `useEffectEvent`. Locally
the committed lockfile happens to already resolve `react@19.2.7` / `react-dom@19.2.7` (both
work), but nothing in `package.json` *guarantees* that — a fresh install, a lockfile
regeneration, or a build environment that resolves independently of the committed lockfile
could all legally satisfy `^19.0.0` with something older and reintroduce the crash. That
gap between "works right now" and "guaranteed by the declared range" is the actual bug, and
is why this recurred once already despite a prior fix attempt.

**Exact peer requirement, extracted directly from `pnpm-lock.yaml`** (see
`peer-requirements.golden.json` for the machine-readable version — re-verify these line
numbers against the live file since it changes on every dependency touch):

- `pnpm-lock.yaml` line ~6261-6263, `sanity@5.31.1:` → `peerDependencies: { react: ^19.2.2,
  react-dom: ^19.2.2, styled-components: ^6.1.15 }`
- `pnpm-lock.yaml` line ~2992, `'@sanity/vision@5.30.0':` → `peerDependencies: { react:
  ^19.2.2, sanity: ^4.0.0-0 || ^5.0.0-0, styled-components: ^6.1.15 }`

So `^19.2.2` is not a suggestion — it's the literal peer range both installed Sanity packages
declare today.

---

## What the fix must do

1. **`package.json`** — bump `"react"` and `"react-dom"` under `dependencies` from `^19.0.0`
   to `^19.2.2` or higher (see `package.json.dependency-ranges.golden` for the exact target
   and acceptable alternatives). Re-verify the peer ranges above against the current
   `pnpm-lock.yaml` before committing to `^19.2.2` specifically — if sanity/vision have been
   bumped since this contract was written, the required floor may have moved.
2. **Regenerate `pnpm-lock.yaml`** (`pnpm install`, no `--frozen-lockfile`, then re-commit the
   lockfile) so react/react-dom resolve to a single deduped version ≥19.2.2 tree-wide, with
   no stray older duplicates anywhere. RF-03/RF-04 in the contract check this by counting
   *distinct resolved versions* of the bare `react@` / `react-dom@` package entries in the
   lockfile — must be exactly 1 each.
3. **Verify the Firebase App Hosting build path is lockfile-respecting.** Check
   `apphosting.yaml` (repo root) and confirm it does not declare a custom `buildCommand` /
   `installCommand` that would bypass `pnpm install --frozen-lockfile`. Confirm there is no
   competing `package-lock.json` or `yarn.lock` at the repo root that could cause Firebase's
   buildpack to misdetect the package manager. Confirm `package.json`'s `"packageManager":
   "pnpm@10.33.0"` field stays pinned (exact version, not a range) — this is what lets the
   buildpack pick the right pnpm version deterministically. RF-10 checks all of this
   statically; it CANNOT confirm what actually happens on Google's build infrastructure — if
   you have access to trigger a real App Hosting build/deploy, do that too and note the
   result in `.agent/memory/project/needs-human.md` if you can't.
4. **Remove the `next.config.ts` webpack workaround (lines ~18-28,
   `config.module.parser.javascript.exportsPresence = false`) ONLY IF step 1-2 make the
   underlying warning genuinely obsolete.** This workaround suppresses a webpack build-time
   warning about the same `useEffectEvent` import (webpack's static CJS→ESM export analysis
   can't see it because `react/index.js` uses a conditional `require`). It is a *build-time
   warning* workaround, separate from the *runtime* crash this contract fixes — do not treat
   "the crash is fixed" as proof the warning is gone too. Test by temporarily removing the
   workaround and running `pnpm build`: if it now builds clean with no export-presence
   warning about `useEffectEvent`, remove it for real; if the warning reappears, put the
   workaround back and leave a comment explaining why it's still needed. The contract does
   NOT gate on this either way (RF-09's `pnpm build` must pass whether the workaround is
   present or removed) — this is judgment-call cleanup, not a required assertion.
5. **Optional, low-risk hygiene, not required:** align `@sanity/vision` (`^5.30.0`) with
   `sanity` core (`^5.31.1`) if you touch `package.json` anyway. Skip if it adds any risk or
   uncertainty — not required for the core fix and not gated by this contract.

---

## What "fixed" must mean (maps to contract assertion IDs)

- RF-01/RF-02 area: `package.json` react/react-dom ranges are genuinely ≥19.2.2 (not just
  "happen to resolve" ≥19.2.2 today).
- RF-03/RF-04: lockfile has exactly one distinct resolved react version and one distinct
  resolved react-dom version, both ≥19.2.2 — no stray duplicates anywhere in the tree.
- RF-05: `pnpm install --frozen-lockfile` completes clean, zero "Unmet peer" warnings
  mentioning react/react-dom against sanity/@sanity/vision.
- RF-06: the golden peer-requirement facts this contract was written against still match the
  live lockfile (staleness guard — if this fails, sanity/vision moved and the whole contract
  needs a re-read, not just the fix).
- RF-07/RF-09: `pnpm type-check` and `pnpm build` both pass. `pnpm lint` is deliberately
  NOT a contract gate — verified during authoring that it currently fails repo-wide
  (2600+ pre-existing errors) because `eslint.config.mjs`'s flat-config `ignores` list
  doesn't exclude the gitignored `Old SAOC Website Backup/` directory at the repo root,
  so it lints thousands of unrelated legacy Joomla template files. That's a pre-existing,
  out-of-scope problem — `pnpm build` and `pnpm type-check` both already pass cleanly
  against the current (unfixed) `package.json`, confirming it's unrelated to this bug.
  Do not fold an eslint.config.mjs fix into this contract.
- RF-10: `apphosting.yaml` has no install/build override, no competing lockfile, pnpm pinned.
- RF-11 (`agent_review`, human/QA step): with `pnpm dev` running, open `/studio`, click into
  any existing document (e.g. a society or event), and confirm the edit pane actually renders
  fields — not the crashed/blank state described in the bug report. This is the one thing
  static analysis cannot confirm; QA runs it manually per this repo's coding standards
  (`.claude/rules/coding.md` — human queue is acceptable for "visual UI aesthetics, physical
  device interaction" and equivalently here, real browser interaction against an embedded
  Studio iframe).

Do not mark this contract's gate green without RF-11 having been actually performed and
recorded — a `skip` verdict from `agent_review` only means "not machine-checkable," not "assumed
passing."
