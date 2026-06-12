# Coding Standards — Mandatory for All Harness Projects

These rules apply to every file written or modified by any agent on this harness.
Non-negotiable. Apply without exception unless the project's own `rules/coding.md` overrides.

## Core Axiom: Code Verifies Code

**Default: automate verification. Human input is the last resort.**

Verification hierarchy — always use the highest level possible:
1. **Automated tests** — pytest, assertions, contract gate shell checks. Always first.
2. **Shell verification** — grep, diff, exit codes, file existence. Use in contract assertions.
3. **Automated UI** — Playwright, screenshot diffing, headless browser. For frontend work.
4. **Human queue** — ONLY for: visual UI aesthetics, physical device interaction, external credentials. Log to `.agent/memory/project/needs-human.md` and continue working.

`agent_review` assertions in contracts are a design smell. Every one is a challenge: can this be automated? If yes, rewrite it as `kind: shell`. Only use `agent_review` when physical human action is genuinely irreplaceable.

---

---

## Style

- **Naming:** `snake_case` for Python/shell variables and functions; `camelCase` for JS/TS; `PascalCase` for classes and React components.
- **Indentation:** 4 spaces for Python; 2 spaces for JS/TS/JSON/YAML; tabs forbidden.
- **Line length:** 100 chars max. Break at logical boundaries, not mid-expression.
- **Imports:** stdlib → third-party → local, separated by blank lines. No wildcard imports.
- **Functions:** Single responsibility. If a function needs a comment to explain what it does, split it.
- **No dead code:** Remove unused variables, imports, and functions before committing.

---

## Best Practices

- **Fail fast:** Validate inputs at system boundaries (user input, API responses, file reads). Never silently swallow errors.
- **Immutability first:** Prefer immutable data structures. Mutate only when performance requires it.
- **No magic numbers:** Named constants only. `MAX_RETRIES = 3`, not `for _ in range(3)`.
- **No print debugging:** Use the logging system. Remove any `print()` / `console.log()` added during debugging before committing.
- **Test-adjacent naming:** Test files mirror source files (`ghost_prime.py` → `test_ghost_prime.py`).
- **Short functions:** If a function exceeds 40 lines, it has more than one responsibility.

---

## Security

- **Never hardcode secrets:** API keys, tokens, passwords → environment variables or `.env.enc`. If a secret appears in source, the commit is invalid.
- **Sanitize all external input:** URLs, file paths, user strings — validate before use. Reject, don't sanitize-and-continue.
- **Parameterised queries only:** No string interpolation into SQL or shell commands.
- **Least privilege:** Request only the permissions actually needed. Default deny.
- **No eval / exec on user input:** Treat any dynamic code execution as a critical vulnerability.
- **Dependency pinning:** Lock file required. No unpinned `latest` in production dependencies.

---

## UI / Frontend

- **Accessibility first:** Every interactive element needs a label, role, and keyboard handler.
- **Mobile-first responsive:** Design for 320px width up. No pixel-fixed layouts.
- **No inline styles:** Use design tokens or utility classes. Inline `style={}` only for dynamic values.
- **Loading + error states mandatory:** Every async operation must show loading and handle error. No silent failures in UI.
- **Component size:** If a component exceeds 150 lines, extract sub-components.

---

## Logging & Debugging

- **Structured logging mandatory:** Use the project logger, not raw print/console.log. Log format: `timestamp | level | module | message | context_dict`.
- **Log levels:** `DEBUG` for trace/diagnostic; `INFO` for significant events; `WARNING` for recoverable issues; `ERROR` for failures; `CRITICAL` for system-breaking events.
- **Every error path logs context:** On exception, log the operation, inputs (sanitised), and exception type. Never log and swallow silently.
- **Request/response logging:** All external API calls log URL, status code, and latency. Redact auth headers.
- **Correlation IDs:** Long-running operations (missions, chains, loops) attach a correlation ID to all log entries for that run.
- **No logging secrets:** Sanitise log output. Mask tokens, passwords, PII before writing to log.
