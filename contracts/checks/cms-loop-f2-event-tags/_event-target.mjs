// F2 (cms-loop-and-wiring): target constants for the /events/[slug] revalidation-tag
// round trip. Reuses contracts/checks/f6-prove-cms-loop/_shared.mjs's now-parameterised
// helpers (readDatasetField, fetchPublicPageContains, openAuthenticatedDoc,
// callRevalidate, setFieldAndPublish) rather than forking them — see the contract
// header for why parameterising instead of copy-pasting was the right call.
//
// TARGET DOCUMENT: societyEvent-10-midlands-orchid-show ("Midlands Orchid Show",
// 2026-10-17, Royal Agricultural Society Hall, PMB). Picked over the 17 other
// societyEvent docs because:
//   - Low-stakes: an ordinary regional show, not the national show, not AGM-adjacent,
//     not referenced by any other contract's byte-for-byte assertions.
//   - Its `description` field is confirmed EMPTY on the live dataset right now
//     (verified via a direct Content Lake read, 2026-08-05) — same "start from a
//     clean, unambiguous baseline" property F6 relied on for aboutPage.boardIntroText,
//     rather than overwriting-and-restoring a field that already holds real content.
//   - `description` renders unconditionally when present, as a plain paragraph:
//     app/(marketing)/events/[slug]/page.tsx — `{event.description ? <p>...</p> : null}`
//     — easy, unambiguous substring match in rendered HTML, same shape as boardIntroText.
//   - Its slug (F5's work) is stable: /events/midlands-orchid-show.
//
// TYPE FOR REVALIDATION: 'societyEvent' — the real Sanity document `_type` (see
// sanity/schemas/documents/event.ts), which is what a genuine webhook payload's
// `body._type` would be. THIS is precisely the mismatch F2 fixes: the page currently
// tags its sanityFetch calls ['events'], which matches neither 'sanity' (the blanket
// tag every revalidate call invalidates) nor 'societyEvent' (the real type tag a
// webhook sends) — so revalidateTag('societyEvent', 'max') currently invalidates
// nothing this page depends on.

export const TARGET_EVENT_DOC_ID = 'societyEvent-10-midlands-orchid-show';
export const TARGET_EVENT_FIELD = 'description';
export const TARGET_EVENT_PAGE_PATH = '/events/midlands-orchid-show';
export const TARGET_EVENT_TYPE = 'societyEvent';

// `societyEvent` is a plain COLLECTION type in sanity/structure.ts
// (S.documentTypeListItem), not a pinned singleton — its Studio deep-link pattern is
// `type;documentId`, not the bare doc id (see openAuthenticatedDoc's structurePath
// param in ../f6-prove-cms-loop/_shared.mjs for why this matters and how it was
// discovered live, 2026-08-05).
export const TARGET_EVENT_STRUCTURE_PATH = `${TARGET_EVENT_TYPE};${TARGET_EVENT_DOC_ID}`;
