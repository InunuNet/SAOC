---
schema: athanor.directive/v1
id: ATH-20261108-every-platform
targets: [all]
issued_at: '2026-11-08'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: Fundamental rule: build for every platform and architecture
verify: grep -q "Build for every platform" .agent/rules/_core/coding.md
---

Brad, 2026-11-08: "We are building for every architecture, all the time. That's a fundamental
rule. Needs to be written into every project. Can't monetize anything if it only works on one
platform."

- **The rule.** Build for every platform: macOS, Windows and Linux, on x64 and ARM64. Work that
  runs on only one is not done; name any platform gap as an open item, never as finished.
- **Where it lives.** `.agent/rules/_core/coding.md`, shipped through the template.

Update at your next natural break: run `make update-template` and commit the result.
