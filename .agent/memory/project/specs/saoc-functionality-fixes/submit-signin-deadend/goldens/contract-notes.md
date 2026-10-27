# submit-signin-deadend goldens

Three dead-end messages in components/events/SubmitEventForm.tsx (no `auth.currentUser`; `getIdToken()` failure; HTTP 401):
  "Please sign in again."
  "Failed to get auth token. Please sign in again."
  "Your session expired — please sign in again."
Each keeps its sentence verbatim; the words "sign in again" become a `next/link` `Link` to `/admin/login?next=/events/submit`
(the login page honours `next` via safeNextPath, which accepts that path). Implementation hint: replace `serverError: string | null`
with a small shape that records whether the message needs the link (e.g. `{ text, signIn: boolean }`) or render ReactNode, and render it
inside the existing `TicketFieldAlert`. Link styling: reuse an existing in-text link class from the page, no new tokens or visual elements.
Not changed: who may submit (open Lee-Ann question), the page gate, the API, the report's optional "disable button until
onAuthStateChanged" (not requested).
