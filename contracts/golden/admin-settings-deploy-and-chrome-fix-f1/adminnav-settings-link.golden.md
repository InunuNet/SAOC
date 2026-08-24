# GOLDEN — components/admin/AdminNav.tsx changes required

Mirrors the existing `canReviewVendors` → Vendors-link pattern exactly (see the file's own
comment at line 46-53 on why Vendors is the one link conditioned there). Settings becomes the
second genuinely capability-gated link, following the identical shape — no new gating
vocabulary invented.

## 1. Props interface gains a second capability flag

```ts
interface AdminNavProps {
  variant: AdminNavVariant;
  canReviewVendors: boolean;
  canManagePaymentSettings: boolean;
}
```

## 2. `buildLinks()` signature and body

```ts
function buildLinks(canReviewVendors: boolean, canManagePaymentSettings: boolean): NavLink[] {
  const links: NavLink[] = [
    { id: 'dashboard', label: 'Dashboard', href: '/admin' },
    { id: 'door', label: 'Door Scanner', href: '/admin/door' },
  ];
  if (canReviewVendors) {
    links.push({ id: 'vendors', label: 'Vendors', href: '/admin/vendors' });
  }
  if (canManagePaymentSettings) {
    links.push({ id: 'settings', label: 'Settings', href: '/admin/settings' });
  }
  return links;
}
```

## 3. Call site inside `AdminNav`

```ts
export function AdminNav({ variant, canReviewVendors, canManagePaymentSettings }: AdminNavProps) {
  ...
  const links = buildLinks(canReviewVendors, canManagePaymentSettings);
  ...
}
```

## 4. Every existing caller must pass the new prop

`app/admin/page.tsx` and `app/admin/vendors/page.tsx` (both already derive `canReviewVendors`
via `hasCapability(...)`) must ALSO derive `canManagePaymentSettings` the same way and pass it
to their existing `<AdminNav variant="bar" canReviewVendors={canReviewVendors} .../>` call —
not just the new settings page. `AdminNavProps.canManagePaymentSettings` is a required boolean,
not optional, so TypeScript's own compiler (A4, `tsc --noEmit`) fails the build if any existing
caller is left un-updated — this is the automated proof the nav link is reachable, not just
addable, from every existing admin surface, satisfying the mission brief's "should likely be
capability-gated the same way the Vendors link is gated."

`app/admin/door/page.tsx` (the `variant="minimal"` caller) also needs the new prop threaded —
same derivation, same requiredness. Door-scanner staff typically won't hold
`manage-payment-settings`, so in practice the overlay's Settings entry will usually not render,
but the prop itself is still required for the type to check.

## What this golden does NOT cover

- Visual styling of the new link — it reuses `renderLinkList()`'s existing per-link classes
  unmodified; nothing new to design.
- The settings page's own chrome (`page-structure.golden.tsx.txt` covers that).
