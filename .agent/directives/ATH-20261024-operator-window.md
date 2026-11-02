---
schema: athanor.directive/v1
id: ATH-20261024-operator-window
targets: [all]
issued_at: '2026-10-24'
status: active
priority: p1
supersedes: ATH-20261024-shipped-blobs
superseded_by: null
platforms: [all]
summary: v3.8.49-54 — your auto-compact window is yours again; vacuous assertions refused; recursive reach checked
verify: python3 execution/directives.py list
---

This covers everything in ATH-20261024-shipped-blobs (v3.8.38 to v3.8.48),
plus:

- **v3.8.52.** The floor stops denying `git diff -- ':(exclude)…' | head`,
  read-only `;`/`&&` chains over an in-project glob, and find pattern
  operands such as `-not -path` values.
- **v3.8.51.** The harness no longer pins `autoCompactWindow` in your
  `.claude/settings.json`. Project settings outrank the user setting that
  `/autocompact` writes, so a window you chose was overridden with "a
  higher-priority override is active (400k)". The update removes the
  key where it still holds a harness value (400000 or 300000). Any other
  value is yours and is kept. Set the window with `/autocompact`.
- **v3.8.50.** The autonomy floor judges recursive commands (`grep -r`,
  `rg`, `tar`, `cp -R`, `rsync -a`, `ditto`, `find | xargs cat`) by what
  their tree reaches; a recursive grep of the home directory was allowed before. A tree over
  50,000 entries is denied as too large to check: name a narrower directory.
- **v3.8.49.** `contract.py validate` and the gate refuse assertions that
  cannot fail again (`… && echo PASS || echo FAIL`, an awk range whose end
  pattern holds `\n`). The check had been off by accident. If an old contract
  now fails validation, rewrite the assertion so its own exit code is the
  verdict. See `docs/harness/assertion-shape.md`.

Update at your next natural break between features. Do not do it in the
middle of a delivery.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Restart Claude Code so the settings change takes effect.
3. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261024-operator-window --result applied`
