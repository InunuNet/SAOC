# `app/admin/door/layout.tsx` — server-side gate for the door scanner

## The defect

`app/admin/door/page.tsx` is `'use client'` with no server-side check anywhere in its
render path, and there is no `middleware.ts` in this repo. The page therefore renders
its full scanner UI (camera permission prompt, manual-entry form) to ANY visitor who
requests `/admin/door`, authenticated or not. The `/api/admin/checkin` POST it talks to
IS gated (401/403 today, confirmed in the mission's measured baseline) — so this is UI
exposure, not a data or check-in capability leak — but "the scanner UI is visible to
strangers" is still the wrong shape for a controlled door at a physical event.

## The fix

A new file, `app/admin/door/layout.tsx`, a Server Component:

```tsx
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';

export default async function DoorLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }
  return children;
}
```

`app/admin/door/page.tsx` itself is UNCHANGED — still `'use client'`, still owns the
scanner and manual-entry UI. The layout wraps it and runs before any of the page's
client JS is sent, exactly the way `app/admin/page.tsx` already gates itself inline
today (same `getAdminSession()` call, same redirect target).

## Why a layout scoped to `/admin/door`, not `/admin`

A layout at `app/admin/layout.tsx` would also wrap `app/admin/login/page.tsx`, which
must stay reachable by an unauthenticated visitor — that is the ONLY way to reach the
sign-in form. Gating the root layout would require either an explicit pathname
exception inside it (fragile — `usePathname` isn't available in a Server Component
layout without reading headers, and reading headers for this is more moving parts than
one extra file) or would infinite-redirect. Scoping the layout to `door/` avoids the
question entirely. If a `/admin/*` catch-all gate is wanted later, that is a bigger
refactor than F1's scope and not done here.

## Verified behaviourally, not by source

`A-DOOR-01` requests `/admin/door` over real HTTP with no cookie and asserts a redirect
to `/admin/login` (not a 200 with scanner markup). `A-DOOR-02` requests it with a
refused probe account's cookie and asserts the same. `A-ALLOW-03` requests it with a
genuinely allowlisted+claimed session and asserts 200 with the scanner page actually
rendering (regression guard — a gate that blocks everyone, including legitimate admins,
must not pass the refusal checks by accident).
