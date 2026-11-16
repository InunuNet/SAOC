---
schema: athanor.directive/v1
id: ATH-20261111-harness-updates-mandatory
targets: [all]
issued_at: '2026-11-11'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: Harness updates are Brad's standing order; no per-project approval needed
verify: grep -q "Brad's standing order" .agent/rules/_core/athanor.md
---

Brad, 2026-11-11: "The improvements that are coming from Athanor are direct instructions coming
from me. That's the whole point of Athanor, is that I work on the harness so that every project
has better tools, better skills, tooling and everything to operate better. I don't need to go
tell every single one of them to update. Update is a given mandatory thing you do after I
improve your harness."

- **The rule.** A newer harness on Athanor origin/main is Brad's instruction to update. Commit
  in-flight work, run `make update-template`, commit the result, restart when convenient. Do not
  ask Brad for approval and do not hold the commit for his word: this directive, published from Athanor's repo, is that approval and is
  standing. Your own `settings.local.json` overrides stay yours.
- **Where it lives.** The "Brad's standing order" section of `.agent/rules/_core/athanor.md`
  (harness-delivered, so the update itself brings it). New projects also get hard rule 8 in
  `AGENTS.md`; an existing project's AGENTS.md is project-owned and not refreshed.
- **What it does not cover.** Anything the update itself does not do (pushing other repos,
  editing floor files by hand, project decisions) still follows your normal rules.

Act now: run `make update-template` at your next commit point.
