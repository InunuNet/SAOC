# Project-Specific Rules

_These override core rules when they conflict. Populated during /onboard._

## Scope

- Only read/write files inside this project directory.
- Never touch sibling project directories without explicit instruction.
- Template updates: `make update-template` (never edit template files directly).

## Team-First Mandate
- Always use specialized agents (@lead, @dev, @qa, etc.) for complex or batch operations to ensure quality and exercise the framework.

## Add project overrides below

### QA Guard Hardcoded Secrets Exclusion
The `qa_guard.sh` script (located in `.agent/pulse/registry/qa_guard.sh`) has been modified to exclude the `contracts/` directory from its hardcoded secret detection. This prevents false positives that would otherwise occur due to contract assertion commands legitimately containing `api_key`, `secret`, `password`, or `token` keywords when checking for environment variables.

<!-- Example:
## Tech Stack Rules
- TypeScript strict mode, no `any`
-->
