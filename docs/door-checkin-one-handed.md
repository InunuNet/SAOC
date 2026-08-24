# F1: Door Check-In — One-Handed Mobile Reachability Fix

**Feature:** F1 of mission `door-checkin-one-handed` (milestone M1). Restructures the `/admin/door` (door scanner) page to use a dvh-budgeted flex column layout so the "Check In" button is reachable one-handed on mobile devices without scrolling. Verifies via real BrowserAgent/Playwright passes at 375×667 (iPhone SE), 320×568 (iPhone 5S), and 1440×900 (desktop sanity).

**Contract:** `.agent/memory/project/specs/door-checkin-one-handed/contract-f1.yaml` and `contracts/golden/door-checkin-one-handed-f1/` — full design record and check scripts.

**Status:** Gated (A1–A4 pass, all 7 structural checks + layout checks + live viewport verifications all pass). QA-passed. Codex cross-model-passed.

---

## Why This Feature Exists

**The original defect:** Brad was operating the live door scanner on Android Chrome during testing and found that the "Check In" button in the manual-entry form was unreachable without scrolling the page. For a door steward scanning dozens of attendees, this is a significant usability defect — they need to operate the scanner one-handed (holding a clipboard or checking a name list in the other hand), and a hidden button is not an acceptable UI.

**Why it happened:** The page used a `min-h-screen` layout, which relies on CSS `vh` (viewport height) units. On mobile browsers (Chrome, Safari), the address bar show/hide changes the actual visible viewport height at runtime — when the address bar shows, `vh` is calculated against the full screen height (including the hidden part of the address bar). When the address bar hides, `vh` is still calculated against the original height, leaving content that depends on it positioned below the real viewport.

**Why a structural layout fix was needed:** This is not a visual design problem (the button renders correctly, just off-screen). It's a fundamental layout problem: CSS `vh` is a broken unit for mobile applications. The fix replaces it with `dvh` (dynamic viewport height), which updates live as the address bar changes, and restructures the layout to guarantee the form is never inside a scroll container.

---

## The Fix

### Layout Structure: `components/admin/DoorScannerClient.tsx`

The root component now uses a **flex column with dvh-budgeted height and explicit overflow handling**:

```typescript
<div className="flex h-dvh min-h-dvh flex-col overflow-hidden">
  {/* Upper region: camera, heading, torch — may scroll internally */}
  <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="space-y-4 px-4 pt-4">
      {/* Scanner heading, camera box, torch button */}
    </div>
  </div>

  {/* Lower region: manual entry form — flex-none, never scrolls, always visible */}
  <div className="mt-5 flex-none">
    {/* Manual entry field + Check In button */}
  </div>
</div>
```

**Key CSS patterns:**

- **Root flex container:** `flex h-dvh min-h-dvh flex-col overflow-hidden`
  - `h-dvh min-h-dvh` — respect dynamic viewport height, update live when address bar appears/disappears
  - `flex-col` — stack regions vertically
  - `overflow-hidden` — prevent scrolling the page itself; scroll only inside explicitly-scrollable regions

- **Upper region:** `min-h-0 flex-1 overflow-y-auto`
  - `flex-1` — grow to fill available space
  - `min-h-0` — allow flex-1 to shrink below content height (required for `overflow-y-auto` to work in a flex column)
  - `overflow-y-auto` — scroll only this region internally if camera/heading content is tall
  - **Critical:** this region is allowed to scroll, but only itself — it cannot push the form below the fold

- **Lower region:** `mt-5 flex-none`
  - `flex-none` — never grow, never shrink; always render at its natural height
  - `mt-5` — top margin for visual separation
  - **Critical:** structurally guaranteed to render below the viewport's real bottom edge, always reachable without scrolling the page

**Why this fixes the problem:** by using `dvh` (which updates dynamically), and by structuring the layout so the form is outside any scrollable container, the form is always positioned at the real bottom of the viewport, regardless of:
- The mobile browser's address bar show/hide state
- Device orientation (portrait/landscape)
- Device model (iPhone SE, iPhone 5S, modern flagship, Android, etc.)

---

## Verification

### A1–A4: Structural Contract Assertions

Standard shell checks (grep, file existence, TypeScript compilation):

- **A1:** `check-layout-structure.sh` — verifies the root div has `h-dvh min-h-dvh flex flex-col overflow-hidden`
- **A2:** `check-layout-structure.sh` — verifies the upper region has `min-h-0 flex-1 overflow-y-auto`
- **A3:** `check-layout-structure.sh` — verifies the lower region has `flex-none`
- **A4:** TypeScript `tsc` compilation pass (structural props and types are correct)

### A7–A8: Live Browser Verification

Real Playwright/BrowserAgent passes at three representative viewports:

1. **375×667 (iPhone SE, typical modern smartphone)**
   - Camera box renders legibly
   - "Check In" button is fully in-viewport
   - Zero outer-page scroll needed to reach button
   - Manual form field and button are interactable one-handed

2. **320×568 (iPhone 5S, smallest typical mobile)**
   - Same assertions as viewport 1 (button reachable without scroll)
   - Validates that the layout doesn't break on the smallest common mobile width

3. **1440×900 (desktop, sanity check)**
   - Page renders without unexpected horizontal scroll
   - All elements are proportionally spaced
   - No layout shift or overflow artifacts

**Checks per viewport (via Playwright DOM assertions):**
- Page loads (HTTP 200)
- Camera box is visible
- Manual entry input is in-viewport
- "Check In" button is in-viewport and has a non-zero width/height (clickable)
- Torch button (if present) is visible
- DoorResultBanner (success/failure overlay) is above the fold and not obscured

**Important:** these are Playwright DOM assertions, not visual judgments. The script checks `element.isVisible()` and bounding box coordinates against the viewport height, never subjective pixel measurements.

---

## Related Documentation

For full manual testing instructions and door scanner operation, see:
- `docs/f4-door-checkin-manual-protocol.md` — manual test steps (sign-in, camera scan, manual entry, refusal handling, Firestore verification, audit trail)

For the success/failure feedback overlay (a separate visual fix), see:
- `docs/door-checkin-success-feedback.md` (when it exists, or check the next feature's changelog for timing)

---

## Code Details

### Component: `components/admin/DoorScannerClient.tsx`

A `'use client'` component that:
1. Wraps the entire door scanner UI in the dvh-budgeted flex column (above)
2. Handles camera access, QR decoding, and manual text entry the same as before (no changes to logic)
3. Renders the DoorResultBanner overlay on success/failure (unchanged)
4. Manages internal scroll on the camera/heading region only

**No changes to:**
- `lib/checkin.ts` — admission logic unchanged
- `/api/admin/checkin` — API route unchanged
- Firestore document structure or audit trail — unchanged
- QR decode library (html5-qrcode) — unchanged

---

## Scope & Non-Changes

- **No visual redesign** — uses existing Tailwind utilities and brand colors, no new tokens introduced
- **No permission/capability changes** — `/admin/door` auth gate (`app/admin/door/page.tsx`) is unchanged
- **No camera behavior changes** — camera access and QR decoding logic unchanged
- **No form submission changes** — manual entry POST to `/api/admin/checkin` unchanged
- **No overlay UX changes** — success/failure banners render exactly as before, just always visible

---

## Why This Pattern Matters for Mobile Admin Tools

This fix establishes a pattern for any admin interface operating on mobile devices:

**✗ Wrong:** Use CSS `vh` for full-height containers, rely on testing in desktop browsers or browser DevTools' mobile emulation (which hides the address bar by default).

**✓ Right:** Use `dvh` for all full-height layouts, test on real devices or Playwright headless browser (which simulates address bar show/hide correctly). Any result, confirmation, or interactive element must be verified against the real viewport height, not just "does it render in the DOM."

---

## Deployment Notes

**This is a client-side UI fix.** No server-side deployment, no infrastructure changes, no Firestore migrations. The only deployment is a code push to Firebase App Hosting. Once pushed and live on `beta.saoc.co.za`, the fix is immediately active for all door stewards.

