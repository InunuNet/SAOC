# Project-Specific Rules

_These override core rules when they conflict. Populated during /onboard._

## Scope

- Only read/write files inside this project directory.
- Never touch sibling project directories without explicit instruction.
- Template updates: `make update-template` (never edit template files directly).

## Team-First Mandate
- Always use specialized agents (@lead, @dev, @qa, etc.) for complex or batch operations to ensure quality and exercise the framework.

## Add project overrides below

<!-- Example:
## Tech Stack Rules
- TypeScript strict mode, no `any`
-->

## Alembic Mandate
- Use Alembic (URL distilling service) for all external URL retrieval and research.
- Verify proxy status (localhost:7077) during boot; if down, notify the user.
