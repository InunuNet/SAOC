# F1: Admin Settings — Chrome Fix & Live Verification

**Feature:** F1 of mission `admin-settings-deploy-and-chrome-fix` (milestone M1). Adds the missing site chrome to `/admin/settings`, adds a capability-gated Settings link to the admin nav, and proves the fix is actually live on `beta.saoc.co.za` via an authenticated browser session (not just a structural source check).

**Contract:** `contracts/golden/admin-settings-deploy-and-chrome-fix-f1/contract-f1.yaml` and `contracts/golden/admin-settings-deploy-and-chrome-fix-f1/README.md` — the full design record. Read the golden README for deployment-timing rules and the live-verification schema.

**Status:** Gated (A1–A4 pass locally; A5–A6 require orchestrator push+deploy). QA-passed. Codex cross-model-passed.

---

## Why This Feature Exists

**The original bug:** mission `ozow-sandbox-toggle` F1 shipped a new `/admin/settings` route in August 2026. The code passed all structural contract assertions locally (a gate green for deployment), but nobody opened it in a real browser or verified the live URL. Result: the route 404s on `beta.saoc.co.za` — a deployed URL that never actually works.

**Why a structural grep alone is insufficient:** a contract assertion that only greps source files (even one checking for `<Header` imports + JSX usage) proves the source code contains the import statement and JSX call. It does not prove:
- The route resolves (it could 404 if the file path is wrong)
- The capability gate doesn't redirect elsewhere unexpectedly
- The deployed bundle actually contains this code
- The component hydrates and renders without a runtime error (only visible in a real browser)

This project's own `docs/behavior.md` and the identical `ozow-m1-f3` mission's live-purchase protocol both document this failure mode. The fix reuses the two-layer pattern:

1. **Structural assertions (A1–A4)** — prove the source code has the right structure (imports, JSX, props wired correctly). Fast, catches an obviously-wrong diff before deploy.
2. **Live BrowserAgent assertion (A6)**, gated behind a deploy-freshness proof (A5) — proves the fix actually works in a browser against the live URL. A4 passing is necessary but **not sufficient** for this feature to be DONE.

---

## The Changes

### 1. New Layout with Chrome: `app/admin/settings/layout.tsx`

The `/admin/settings` subtree previously had no layout — `page.tsx` rendered bare. A new layout now wraps the subtree with the full chrome stack, matching the pattern already used by `app/admin/page.tsx` and `app/admin/vendors/page.tsx`:

```typescript
export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session.ok) redirect('/admin/login');
  
  const canManagePaymentSettings = hasCapability(
    session.decodedToken,
    NATIONAL_SHOW_ID,
    'manage-payment-settings',
    { now, lookupShowWindow },
  );
  if (!canManagePaymentSettings) redirect('/admin');
  
  const canReviewVendors = hasCapability(...);
  const show = await sanityFetch(...);

  return (
    <>
      <UtilityBar show={show} />
      <Header />
      <AdminNav
        variant="bar"
        canReviewVendors={canReviewVendors}
        canManagePaymentSettings={canManagePaymentSettings}
      />
      {children}
      <Footer />
    </>
  );
}
```

**Why this is the right place:** the layout already has `session` and show-window context in scope, both required by `<Header>` and `<AdminNav>`. The toggle UI itself (`app/admin/settings/page.tsx`) is a `'use client'` component that cannot call `sanityFetch()` or `hasCapability()` — the layout is the lower-risk place to grow the chrome without restructuring the page component.

### 2. Capability-Gated Settings Link: `components/admin/AdminNav.tsx`

`AdminNav`'s props now require a `canManagePaymentSettings` boolean:

```typescript
interface AdminNavProps {
  variant: AdminNavVariant;
  canReviewVendors: boolean;
  canManagePaymentSettings: boolean;  // ← new required prop
}
```

The `buildLinks()` function now takes both capability booleans and conditionally appends the Settings link:

```typescript
function buildLinks(canReviewVendors: boolean, canManagePaymentSettings: boolean): NavLink[] {
  const links: NavLink[] = [
    { id: 'dashboard', label: 'Dashboard', href: '/admin' },
    { id: 'door', label: 'Door Scanner', href: '/admin/door' },
  ];
  if (canReviewVendors) {
    links.push({ id: 'vendors', label: 'Vendors', href: '/admin/vendors' });
  }
  if (canManagePaymentSettings) {
    links.push({ id: 'settings', label: 'Settings', href: '/admin/settings' });  // ← new
  }
  return links;
}
```

**Consistency pattern:** This reuses the exact same pattern already used for the Vendors link (gated on `review-vendor-applications` capability). Future admin pages that need a nav link should:
1. Derive the capability server-side: `const canDo = hasCapability(..., 'capability-name', ...)`
2. Pass it as a required prop to `<AdminNav>`
3. Let `buildLinks()` conditionally append a link object

---

### 3. Updated Admin Pages: `app/admin/page.tsx`, `app/admin/vendors/page.tsx`, `app/admin/door/page.tsx`

Each existing admin page now derives and passes the new required prop to `<AdminNav>`:

```typescript
const canManagePaymentSettings = hasCapability(
  session.decodedToken,
  NATIONAL_SHOW_ID,
  'manage-payment-settings',
  { now, lookupShowWindow },
);

// ... existing AdminNav call now includes the prop:
<AdminNav
  variant="bar"
  canReviewVendors={canReviewVendors}
  canManagePaymentSettings={canManagePaymentSettings}  // ← added
/>
```

TypeScript enforces this at compile time — if any call site forgets the prop, `tsc` fails (assertion A4).

---

### 4. Live Verification Script: `contracts/checks/admin-settings-deploy-and-chrome-fix-f1/check-live-chrome.mjs`

A new Node.js script verifies the fix is actually deployed and working on `beta.saoc.co.za`. It:

1. **Mints an authenticated session** — uses `FIREBASE_ADMIN_*` credentials to create a custom token for an existing allowlisted admin (no new user, no OAuth UI). Exchanges it for an ID token and sends it to `/api/admin/session` to capture a session cookie.

2. **Runs dual browser sessions** — Playwright at desktop (1440×900) and mobile (375×812) viewports, both authenticated via the session cookie, navigating to `/admin/settings`.

3. **Runs 7 DOM-derived checks** per viewport:
   - `page-loads-200` — HTTP 200 (not 404 or redirect to `/admin/login`)
   - `utility-bar-present` — UtilityBar root element visible
   - `header-present` — Header root element visible
   - `admin-nav-present` — Nav with `aria-label="Admin"` visible
   - `settings-link-in-nav` — Link with `href="/admin/settings"` present and reachable (on desktop unhidden, on mobile reachable via hamburger)
   - `footer-present` — Footer root element visible
   - `toggle-still-functions` — The existing Ozow sandbox toggle is present and functional

4. **Writes artifact JSON** to `.agent/memory/scratch/admin-settings-chrome-runs/<viewport>-<ISO-timestamp>.json` — each check's pass/fail comes from a Playwright DOM locator assertion, never from the script's own visual judgment. Screenshots are supporting evidence only.

5. **Independently verifies** the final result by re-reading both artifacts and checking:
   - Both `desktop-*.json` and `mobile-*.json` present
   - All 7 named checks in both artifacts with `pass === true`
   - Each artifact's `allChecksPassed === true`

**Important:** this script only runs **after the orchestrator has pushed and Firebase App Hosting has rolled out the code**. A5 (deploy-freshness check) must pass first.

---

## The Capability-Gating Pattern for Future Admin Pages

This feature establishes a reusable pattern for adding new capability-gated admin surfaces:

1. **Create a new layout** (or re-use an existing subtree layout) that:
   - Calls `getAdminSession()` and redirects to `/admin/login` if not ok
   - Calls `hasCapability(..., 'your-capability-name', ...)` to get a boolean
   - Redirects to `/admin` if the capability check fails
   - Passes the boolean to `<AdminNav variant="bar" canYourCapability={boolean} ...>`

2. **Update `AdminNav.tsx`**:
   - Add the capability boolean to `AdminNavProps`
   - Update `buildLinks()` to accept it and conditionally append a link

3. **Update all existing `<AdminNav>` call sites** to pass the new required prop (TypeScript enforces this).

Example for a hypothetical `/admin/reports` page:

```typescript
const canViewReports = hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'view-reports', { now, lookupShowWindow });
if (!canViewReports) redirect('/admin');

return (
  <>
    <UtilityBar show={show} />
    <Header />
    <AdminNav variant="bar" canReviewVendors={...} canManagePaymentSettings={...} canViewReports={canViewReports} />
    {children}
    <Footer />
  </>
);
```

---

## Post-Deploy Verification (A5 & A6)

### A5: Deploy Freshness Check

Run after the orchestrator has committed and pushed:

```bash
bash contracts/checks/admin-settings-deploy-and-chrome-fix-f1/check-deploy-freshness.sh
```

This verifies:
- `HEAD` is reachable from `origin/main` (code has been pushed)
- Firebase App Hosting's most recent rollout `updateTime` is AFTER `HEAD`'s commit time (live code is running the feature)

### A6: Live Browser Verification

Run **only after A5 passes**:

```bash
node contracts/checks/admin-settings-deploy-and-chrome-fix-f1/check-live-chrome.mjs
```

This script:
- Mints a real session for an existing admin
- Navigates to `https://beta.saoc.co.za/admin/settings` in both desktop and mobile viewports
- Verifies all 7 checks pass (chrome present, Settings link visible and functional, toggle still works)
- Writes artifacts to `.agent/memory/scratch/admin-settings-chrome-runs/`

If any check fails, the script exits with details. Artifacts are the source of truth — never trust the script's console output alone.

---

## Scope & Non-Changes

- **No visual redesign** — reuses existing UtilityBar, Header, AdminNav, Footer components with no color, spacing, or typography changes.
- **The toggle UI is untouched** — the existing `app/admin/settings/page.tsx` with its `useState`/`useEffect` checkout state and PUT flow behaves identically; only its container changes.
- **Existing capabilities unchanged** — `manage-payment-settings` and the layout's capability gate (`app/admin/settings/layout.tsx` already gated on it) are not modified.

---

## Deployment Notes

**Deployment is part of DONE, not a separate step.** Per `.claude/rules/workflow.md`, only the orchestrator commits and pushes — @dev/@architect/@qa never do. This feature's A5–A6 assertions cannot pass until:

1. Orchestrator commits the diff
2. Orchestrator pushes to `main`
3. Firebase App Hosting picks up the rollout

After that, run A5 to confirm freshness, then A6 to confirm the live site renders correctly.
