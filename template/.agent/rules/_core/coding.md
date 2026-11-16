---
description: Craft rules for writing source code.
paths:
  - "**/*.{py,sh,js,ts,tsx,jsx,go,rs}"
---

# Coding Standards

- Write real code: no placeholders, stubs or `TODO` standing in for an implementation. If a
  piece cannot be written yet, say so.
- Read before you write: open the file and its neighbours, match the idiom (naming,
  indentation, error handling, comment density).
- Handle the error path: validate at system boundaries, fail fast and loudly, never swallow an
  exception. Log operation, sanitised inputs and exception type; never secrets.
- Leave nothing dead: remove unused variables, imports and functions in the change that
  orphans them; strip debugging output.
- Name the constant; credentials come from the environment or an encrypted store.
- Verify with code, not hope: a test, an exit code, a diff.
- Build for every platform: macOS, Windows and Linux, on x64 and ARM64. Work that runs on only one is not done; name any platform gap as an open item, never as finished (Brad 2026-11-08: "Can't monetize anything if it only works on one platform").
