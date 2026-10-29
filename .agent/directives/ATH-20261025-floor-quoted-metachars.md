---
schema: athanor.directive/v1
id: ATH-20261025-floor-quoted-metachars
targets: [all]
issued_at: '2026-10-25'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.70 — a quoted | ; & \ ( ) in a regex no longer gets an in-project glob read denied
verify: python3 execution/directives.py list
---

- **v3.8.70: the floor honours quotes in its syntax screens.** Before this
  release, a glob read with an alternation or escape in a quoted regex was
  denied as a protected-path read:

  ```sh
  grep -h -o -E '^\s*(type|kind):\s*\S+' .agent/memory/project/specs/*/contract.yaml contract.yaml
  ```

  The floor split the command on `|`, `;` and `&` without regard to quotes,
  so it read the regex as a pipeline, decided the cwd was unknown, and
  denied every wildcard. A `|`, `;`, `&`, `\` or `( )` inside single or
  double quotes is now treated as text. A real separator, a `cd`,
  `$( )`, a `#` comment, or `$'...'` quoting still makes a glob read
  unknowable, exactly as before. If you split a grep into two greps or
  dropped the alternation to get around this, you can stop doing that.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261025-floor-quoted-metachars --result applied`
