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

### Visual work is not done until a browser has seen it

**Any change that affects what a page looks like MUST be verified in a real browser before it
is reported as complete.** Use the `BrowserAgent` agent (Playwright) to load the page and
capture screenshots at desktop (1440px) and mobile (375px and 320px), tab through every
interactive element to confirm visible focus, and check the console for errors.

**Why:** contract assertions and structural greps cannot see a rendered page. On 2026-08-15
the admin login page shipped with a green 6/6 gate while rendering as bare text with
*invisible input fields*, and the dashboard and door scanner behind it were raw unstyled
HTML. Every check passed. The user found all of it. A designer agent reading back its own
Tailwind class names is not verification — it is the same claim restated.

**How to apply:**
- A design/UI agent with no browser MUST say so and MUST NOT call the work confirmed.
- Dispatch `BrowserAgent` at the deployed URL (or a local dev server) and require it to
  describe rendered pixels, not source. Tell it to be blunt if the page looks wrong.
- Check the pages *behind* the one reported. The login fix was requested; the dashboard one
  click away had the identical defect and nobody looked.
- Compare against a known-good page on the same site to confirm it belongs there.
