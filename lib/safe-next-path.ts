// lib/safe-next-path.ts
// Mission nos-site-split F4 — the `next` parameter on /admin/login is a same-origin path and nothing
// else. Pure and import-free so the server gate (lib/media-kit-gate.ts) and the client login page
// share one definition.

const DEFAULT_NEXT = '/admin';
const UNSAFE_CHARACTERS = /[\\\u0000-\u001f\u007f]/;

/**
 * Returns `raw` when it is a path on this origin: one leading slash, no `//` (protocol-relative),
 * no backslash (browsers read it as a slash), no control characters. Anything else is `fallback`.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_NEXT): string {
  if (typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (UNSAFE_CHARACTERS.test(raw)) return fallback;
  return raw;
}
