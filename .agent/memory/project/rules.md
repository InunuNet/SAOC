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

### Site hierarchy — NOS is a SUBSECTION of saoc.co.za. Never re-litigate this.

```
saoc.co.za                     <- THE home. The South African Orchid Council's site.
  └── /national-show           <- the National Orchid Show (NOS). A SUBSECTION.
        └── its marketing pages
```

- **saoc.co.za is the home. There is exactly one home page, and it belongs to SAOC.**
- The **National Orchid Show (NOS)** runs **every three years** (next: 2027). It is a
  promotional event subsection of the SAOC site — a "promo event on the Council's site",
  not a site of its own.
- NOS is **branded as if it were a different company** — its own styling, its own identity,
  visually distinct from SAOC. That branding is *presentation only*. It does not make NOS a
  separate site, and it never earns NOS a home page of its own.
- **There is no NOS "Home" page.** Lee-Ann's `Website Development SpecificationV3` lists
  "1. Home" for the show; that means the **`/national-show` landing page, which already
  exists**. Do not create a home page for the show. Do not treat the show as a site root.
- **Scope of work on the show: the subsection only.** All marketing pages under
  `/national-show`. Never the SAOC parent site, never a sibling section.

**Why this is written down:** on 2026-09-09 the orchestrator presented Lee-Ann's spec page
"1. Home" as a page to be built, which reads as giving the show its own home page. Brad's
correction: "SAOC.co.za is the home. They're just a subsection, like a promo event."

### Invented copy must be notarised as invented

Most NOS pages have no copy from the council yet. Inventing placeholder copy is **approved by
Brad** — on one non-negotiable condition: **every page carrying invented copy must declare it,
visibly, at the top of the page.** The declaration is driven by a flag on the content itself,
so a page *cannot* render invented copy silently; it is never a banner someone remembers to
add. When the council supplies real copy and the flag is cleared, the notice disappears.

**Note:** `CLAUDE.md` is write-protected by `execution/hooks/check_autonomy.sh` (always denied),
so durable project rules go here, in `.agent/memory/project/rules.md`, which is loaded into
every session's boot context.
