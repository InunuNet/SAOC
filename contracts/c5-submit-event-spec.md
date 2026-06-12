# C5 — Submit-an-event form: Implementation Spec

**Contract:** `/Users/vetus/ai/SAOC/contracts/c5-submit-event.yaml`
**Owner:** @dev · **Reviewer:** @qa
**Goal:** Members-only page at `/events/submit` where an authenticated SAOC
member submits a new event. The submission creates an **unpublished Sanity
draft** (`drafts.societyEvent-…`) so council approves it in Sanity Studio.

---

## 0. Grounding facts (verified against the repo)

| Concern | Reality in this repo — use exactly this |
|---|---|
| Firebase Admin init | `lib/firebase-admin.ts` exports `initAdmin(): App` (singleton). Env vars: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`. |
| Firebase client init | `lib/firebase.ts` exports `getFirebaseApp(): FirebaseApp`. |
| Sanity write token | `process.env.SANITY_API_TOKEN` (already in `.env.local.example`). Seed script `scripts/seed-sanity.ts` shows the canonical write-client pattern. |
| Sanity client lib | `sanity/lib/client.ts` exports read-only `client` (no token, `useCdn: true`). **Do NOT mutate with this.** Build a separate write client. |
| Sanity env | `sanity/env.ts` exports `projectId`, `dataset`, `apiVersion`. |
| Event shape | `societyEvent` doc fields: `title`, `slug` (`{_type:'slug', current}`), `date`, `endDate`, `kind`, `description`, `venue`, `location`, `isFeatured`, `hostSociety` (reference). See `SanityEvent` in `types/index.ts`. |
| ISR tag for events | `'events'` (and `'sanity'`). Existing routes tag with `['events','sanity']`. |
| Package mgr | **pnpm**. Type-check: `pnpm type-check`. Build: `pnpm build`. Lint: `pnpm lint`. |
| TS rules | strict, **no `any`**, no unexplained assertions, Server Components by default. |

> **Never import `firebase-admin` or `SANITY_API_TOKEN` into a client component.**
> The form is the only `'use client'` file; admin + write token live only in the route + page.

---

## 1. File 1 — `app/(marketing)/events/submit/page.tsx` (Server Component, guard)

A server-rendered page that gates on the Firebase session **cookie** read
server-side.

### Behaviour
1. `import 'server-only'` is optional but encouraged.
2. Read the session cookie: `const session = (await cookies()).get('session')?.value;`
   (Next 15 — `cookies()` is async, `import { cookies } from 'next/headers'`.)
3. If no cookie → render the **login prompt** (static UI block, no client JS):
   a heading "Members only", a short line "Sign in to submit an event for
   council review.", and a link to `/login` (or `/account`). Keep it plain —
   no brand tokens invented (see CLAUDE.md). Use existing Tailwind utility
   classes already present in sibling pages.
4. If a cookie exists, verify it:
   ```ts
   import { initAdmin } from '@/lib/firebase-admin';
   import { getAuth } from 'firebase-admin/auth';
   // ...
   try {
     initAdmin();
     await getAuth().verifySessionCookie(session, true);
   } catch {
     // render login prompt (same block as step 3)
   }
   ```
   On success render `<SubmitEventForm />`.
5. Wrap admin calls in try/catch so a missing-credentials build (CI) degrades
   to the login prompt instead of throwing — mirror the graceful-null pattern
   used in `sanityFetch`.

> The contract only requires that this page references firebase-admin
> (`initAdmin`/`getAuth`) (assertion C5-07). Session-cookie vs. bearer is a page
> concern; the **API** uses bearer ID tokens (below).

### Metadata
Export `const metadata = { title: 'Submit an Event — SAOC', robots: { index: false } }`
(noindex — members-only).

---

## 2. File 2 — `components/events/SubmitEventForm.tsx` (`'use client'`)

First line MUST be `'use client';` (assertion C5-04, checked in first 3 lines).

### Fields (exact names — these become the JSON body keys)
| name | input | required | validation |
|---|---|---|---|
| `title` | text | yes | non-empty, trimmed |
| `kind` | select | yes | one of `exhibition \| meeting \| show \| workshop \| social` |
| `date` | date | yes | parseable; **must be strictly in the future** (`> today`) |
| `endDate` | date | no | if present, `>= date` |
| `venue` | text | yes | non-empty |
| `location` | text | yes | non-empty |
| `description` | textarea | yes | trimmed length `>= 20` |
| `hostSocietyId` | text | no | optional free text (Sanity doc `_id` of a society) |

### Local state
- `const [values, setValues] = useState<FormValues>(initial)` — define a
  `type FormValues` with the 8 keys above (all `string`). No `any`.
- `const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})`
- `const [status, setStatus] = useState<'idle'|'submitting'|'success'|'error'>('idle')`
- `const [serverError, setServerError] = useState<string | null>(null)`

### Client-side validation (`validate(values): errors`)
Run on submit. Block POST if any error. Show inline messages. Mirror the
server rules so the UX matches the API (date-in-future, endDate>=date,
description>=20).

### Submit flow
```ts
const auth = getAuth(getFirebaseApp());        // firebase/auth client SDK
const user = auth.currentUser;
if (!user) { setServerError('Please sign in again.'); return; }
const token = await user.getIdToken();

const res = await fetch('/api/events/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,          // assertion C5-06
  },
  body: JSON.stringify(values),
});
```
- `import { getAuth } from 'firebase/auth';` and `import { getFirebaseApp } from '@/lib/firebase';`
- 201 → `setStatus('success')`, clear form, show "Submitted for council review."
- 400 → read `{ error, field? }`, map `field` into `errors`, else show `error`.
- 401 → "Your session expired — please sign in again."
- Endpoint string MUST be the literal `/api/events/submit` (assertion C5-05).

### Markup
Plain semantic form: `<label htmlFor>` + input for each field, a submit
button disabled while `status==='submitting'`, and an `aria-live="polite"`
status region. No invented colours/fonts.

---

## 3. File 3 — `app/api/events/submit/route.ts` (POST handler)

```ts
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@sanity/client';      // or next-sanity
import { initAdmin } from '@/lib/firebase-admin';
import { projectId, dataset, apiVersion } from '@/sanity/env';

export const runtime = 'nodejs';   // firebase-admin needs Node, not Edge
```

### Step-by-step

1. **Extract bearer token**
   ```ts
   const authz = req.headers.get('authorization') ?? '';
   const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
   if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   ```

2. **Verify token**
   ```ts
   let uid: string;
   try {
     initAdmin();
     const decoded = await getAuth().verifyIdToken(token);
     uid = decoded.uid;
   } catch {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```
   (Assertions C5-09 + the 401 in C5-11.)

3. **Parse + validate body** — define a server `type SubmitBody`. Validate:
   - `title` non-empty → else `{ error:'Title is required', field:'title' }` 400
   - `kind` ∈ allowed set → else `field:'kind'`
   - `date` parseable AND `new Date(date) > new Date()` → else `field:'date'`
   - `endDate` if present parseable AND `>= date` → else `field:'endDate'`
   - `venue` non-empty → `field:'venue'`
   - `location` non-empty → `field:'location'`
   - `description.trim().length >= 20` → `field:'description'`
   - `hostSocietyId` optional string
   All failures: `return NextResponse.json({ error, field }, { status: 400 });`

4. **Build the write client** (separate from read-only `sanity/lib/client.ts`)
   ```ts
   const token2 = process.env.SANITY_API_TOKEN;
   if (!projectId || !token2) {
     return NextResponse.json({ error: 'CMS not configured' }, { status: 500 });
   }
   const writeClient = createClient({
     projectId, dataset, apiVersion, token: token2, useCdn: false,
   });
   ```
   (Assertion C5-10.)

5. **Compute slug + draft id**
   - `slugify(title)` — copy the exact helper used in `app/api/events.ics/route.ts`:
     ```ts
     title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
     ```
   - `const datePart = date.slice(0, 10);   // YYYY-MM-DD`  (input type=date already gives YYYY-MM-DD; if ISO, slice 10)
   - `const slug = `${slugify(title)}-${datePart}`;`  — **slug formula** (matches spec).
   - `const id = `drafts.societyEvent-${crypto.randomUUID()}`;`
     (`crypto` is global in Node 18+ runtime; no import.) (Assertion C5-12.)

6. **Create the draft**
   ```ts
   const doc: Record<string, unknown> = {
     _id: id,
     _type: 'societyEvent',
     title,
     slug: { _type: 'slug', current: slug },
     date,                       // store ISO/date string as-is
     ...(endDate ? { endDate } : {}),
     kind,
     description,
     venue,
     location,
     isFeatured: false,
     ...(hostSocietyId
       ? { hostSociety: { _type: 'reference', _ref: hostSocietyId } }
       : {}),
     // audit trail (optional but recommended): submittedBy uid
     submittedByUid: uid,
   };
   await writeClient.createIfNotExists(doc);   // create draft
   ```
   Use `createIfNotExists` (idempotent) or `create`. Do NOT publish.

7. **Respond 201**
   ```ts
   return NextResponse.json({ id, slug }, { status: 201 });
   ```
   (Assertion C5-11 + the shape required by the spec.)

8. Wrap the mutation in try/catch → on failure `500 { error: 'Failed to create draft' }`.

---

## 4. Response contract (for @qa)

| Case | Status | Body |
|---|---|---|
| Missing/invalid bearer | 401 | `{ error: 'Unauthorized' }` |
| Validation failure | 400 | `{ error: string, field?: string }` |
| CMS env missing | 500 | `{ error: 'CMS not configured' }` |
| Mutation throws | 500 | `{ error: 'Failed to create draft' }` |
| Success | 201 | `{ id: string, slug: string }` |

---

## 5. Implementation order (suggested)
1. Route (`route.ts`) — pure, testable with curl.
2. Form component — wire to the route.
3. Guard page — render the form for authed users.
4. Run gates: `pnpm type-check` (0 `error TS`), `pnpm lint`, `pnpm build`.

## 6. Do / Don't
- DO keep `runtime = 'nodejs'` on the route (firebase-admin is Node-only).
- DO reuse the existing `slugify` regex from `app/api/events.ics/route.ts`.
- DO degrade gracefully when admin creds / Sanity token absent (CI build).
- DON'T import firebase-admin or `SANITY_API_TOKEN` into the client form.
- DON'T mutate via the read-only `sanity/lib/client.ts` client.
- DON'T invent brand colours/fonts — await Claude Design handoff.
- DON'T publish the event — draft only (`drafts.` prefix).
