# F1–F5: Backlog Sweep 2 — Dead Links and Accessibility

**Features:** F1–F5 of mission `backlog-sweep-2-dead-links-and-a11y` (milestone M1). Five independent accessibility and routing fixes: WOSA link correction (wrong domain), events.ics routing defect (404ing), constitution page disclaimer alignment, national show archive cards converted to interactive elements with proper keyboard navigation, and vendor registration email validation with client/server consistency.

**Mission brief:** `.agent/memory/project/missions/2026-08-21-backlog-sweep-2-dead-links-and-a11y.md` — the full record; read it first for context. **This doc is the guide; that is the specification.**

**Status:** Gated, QA-passed (real browser verification, Playwright e2e checks), Codex GPT-5.5 cross-model-passed (including discovery and repair of a real email-trim-mismatch bug that Claude's own @qa missed).

---

## Why This Feature Exists

This mission pulls five small, independently-scoped defects and accessibility gaps from the project backlog — items that required no new design decisions, no Brad/council approval, and no blocked dependencies. All reuse patterns already proven elsewhere in the codebase, minimizing implementation risk and keeping the team unblocked on backlog maintenance.

**Mandatory Codex review discovered a real bug:** Mid-mission, Codex GPT-5.5's independent cross-model review found a client/server email-validation mismatch (F5) that Claude's own QA passed over — the client validator trimmed whitespace before testing email format, but the payload sent the untrimmed value, causing whitespace-padded emails to pass client-side and fail server-side. This incident is a concrete example of why this project's workflow mandates a Codex pass *after* Claude's own @qa, not instead of it: the same model reviewing its own code misses defect classes an independent model catches reliably.

---

## F1: Footer WOSA Link — Domain Correction

### Background

The project's CLAUDE.md defines a critical scope boundary: SAOC focuses on orchids *in cultivation*; wild orchid identification and conservation belong to **WOSA (Wild Orchids of Southern Africa)**, a separate partner organisation with its own site. The footer links to WOSA but points to `wosa.co.za`, which resolves to **Wines of South Africa** — a completely unrelated organisation.

The correct WOSA domain is `wildorchids.co.za`.

### The Fix

**`components/chrome/Footer.tsx`**
- Updated the WOSA link href from `https://wosa.co.za` to `https://wildorchids.co.za`.
- No other changes to the link text, styling, or surrounding footer structure.

### Out of Scope

WOSA's own website, branding, or content. This project only links to them; they maintain their own site.

---

## F2: Events Feed Routing — /events.ics Redirect

### Background

The project publishes an events calendar feed at `/api/events.ics` (API route). Public documentation and links refer to the shorter URL `/events.ics`, which previously 404ed. Users and tools expecting the public path failed silently.

### The Fix

**`next.config.ts`**
- Added a `redirects()` entry mapping `/events.ics` → `/api/events.ics`.
- Users and feed readers now reach the correct route transparently; no client-side changes needed.

### Verification

Tested via direct browser navigation and `.ics` file reader (calendar application) import to verify the feed loads and parses correctly.

---

## F3: Constitution Page Disclaimer — Alignment with Privacy/Terms

### Background

The `/privacy` and `/terms` pages both display a prominent disclaimer: "AI-generated draft, not legal advice." The `/constitution` page lacked this disclaimer, creating inconsistent messaging about legal content handling site-wide.

### The Fix

**`app/(marketing)/constitution/page.tsx`**
- Added the identical disclaimer block to the constitution page, byte-for-byte matching the `/privacy` and `/terms` implementations.
- Ensures users see consistent, credible messaging across all legal/policy content.

### Implementation Details

The disclaimer is a styled callout box:
```jsx
<div className="bg-bone px-6 py-4 border-l-4 border-accent rounded-sm">
  <p className="text-sm text-primary-800">
    <strong>Important:</strong> This is an AI-generated draft, not legal advice. Always consult with a qualified legal professional for official guidance.
  </p>
</div>
```

---

## F4: National Show Archive Cards — Interactive Links

### Background

The `/national-show/archive` page displays five past-show edition cards (2023–2027 archives) as non-interactive divs with zero click handling. While the page layout is visual, users expecting to click a card to view show details encounter nothing: no `<a>` elements, no focus rings, no keyboard navigation.

### Root Cause

The archive cards were static presentation elements, not interactive routes. No architectural reason prevented them from becoming real links.

### The Fix

**`app/(marketing)/national-show/archive/page.tsx`**
- Converted archive edition cards from `<div>` to `<Link>` elements pointing to the show detail route (`/national-show/archive/[year]`).
- Applied the site-wide focus-ring pattern: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment`.
- Keyboard users can now tab through cards and press Enter to navigate; screen readers announce them as links.

### Verification

Tested via real browser keyboard navigation (Tab, Enter) and screen-reader inspection (DevTools Accessibility panel) at 375px mobile and 1440px desktop. Focus is visibly distinct; links are semantically correct.

---

## F5: Vendor Registration Email Validation — Client/Server Consistency

### Background

The vendor registration form (`/national-show/vendors/register`) previously accepted any non-empty string in the email field, both client-side and server-side. No email-format validation existed.

**Mandatory Codex GPT-5.5 review discovered a real bug:** The client-side validator trimmed whitespace before testing email format, but the payload builder sent the untrimmed value to the server. This mismatch meant a whitespace-padded string like `" user@example.com "` would:
1. Pass client validation (trimmed to `user@example.com`, which is valid)
2. Fail server validation (raw untrimmed value `" user@example.com "` is not a valid email)

Result: form submission succeeded UI-side, but the server rejected it silently. This is the exact defect class this project has struggled with elsewhere (see `project_secret_corruption_class.md` in project memory): always prove a credential authenticates after writing it.

### The Fix

**`lib/vendor-register-form-validation.ts`**
- Added real email-format validation: `const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- Client validator now checks email format before form submission.

**`lib/vendor-register-form-payload.ts`** (line 105)
- Trim the email *in the payload builder*, not before validation.
- Server receives the trimmed, validated value, ensuring client/server agreement.

**`lib/vendor-submissions.ts`**
- Added server-side email-format validation as a defensive check, rejecting malformed emails at the boundary.

**`components/vendors/VendorRegisterStatusBanner.tsx`**
- Restyled the status banner off the low-contrast `text-accent` pattern onto the high-contrast bordered-callout pattern (matching F3's constitution disclaimer and the admin error callouts from the prior backlog sweep).

### Implementation Details

Email regex pattern:
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

This checks:
- Non-whitespace characters before `@`
- Non-whitespace characters between `@` and `.`
- Non-whitespace characters after `.`

Prevents common mistakes: missing domain, extra spaces, missing TLD.

### Why Codex Found This

Codex GPT-5.5's independent review caught the trim-mismatch defect because:
1. It read the client validator in isolation: "trim, then validate."
2. It then read the payload builder in isolation: "send untrimmed value."
3. These two pieces together create a contradiction only visible when reading *both* functions as a system, not one at a time.

Claude's own @qa reviewed each function as it was written (sequential context), never seeing the full diff of all F5 changes at once until late in the cycle. The cross-model review, which reads the *completed diff*, caught the inconsistency immediately.

This is the intended reason this project's workflow mandates a Codex pass *in addition to* Claude's own @qa review: different analysis models have different blind spots. For sequential-writing defects and client/server mismatches, an independent model is reliable proof.

### Verification

Tested via:
1. Real browser form submission with valid, invalid, and whitespace-padded emails.
2. Server-side Firestore write verification (confirmed emails stored correctly trimmed).
3. Screen-reader testing on the restyled banner (status announcements are now audible at full contrast).

---

## Implementation Notes

- **No new colour tokens introduced.** All fixes reuse existing colours (`ink/40`, `parchment`, `accent`, `primary-800`, `bone`).
- **No design decisions pending.** All patterns were already proven in the codebase (nav-link focus rings, admin error callouts, existing responsive utilities).
- **Codex GPT-5.5 as part of QA workflow:** The trim-mismatch discovery is a worked example of why this project's workflow mandates Codex review after @qa. See `rules/workflow.md` for the mandatory chain and rationale.
- **Client/server validation is now symmetric:** Email format is validated identically on both sides; trimming happens in the payload, not during validation, eliminating the mismatch vector.
- **Accessibility tooling:** Used browser DevTools Accessibility panel and real screen-reader testing (not visual screenshots alone) to verify focus rings and banner audibility.

---

## Contract & Golden Files

See `.agent/memory/project/specs/backlog-sweep-2-dead-links-and-a11y/`:
- `contract-m1.yaml` — gate assertions (grep for WOSA domain, email regex, redirect config, focus-ring classes, disclaimer text; Playwright e2e checks for archive-card navigation)
- `goldens/m1-golden.md` — expected code patterns and diff summary
