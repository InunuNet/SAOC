'use client';

import { useEffect, useState } from 'react';

// Whether this browser holds a signed-in admin session, asked of /api/admin/whoami after hydration so
// the page itself stays static (no cookies() read, ISR intact). Shared with AdminPill: a negative answer
// is remembered in sessionStorage for ten minutes, so an anonymous visit asks once per window.
export const WHOAMI_URL = '/api/admin/whoami';
const NOT_ADMIN_CACHE_KEY = 'saoc-admin-pill-not-admin';
const NOT_ADMIN_CACHE_MS = 10 * 60 * 1000;
export const WHOAMI_TIMEOUT_MS = 5000;

export function readNotAdminCache(): boolean {
  try {
    const stored = window.sessionStorage.getItem(NOT_ADMIN_CACHE_KEY);
    return stored !== null && Date.now() - Number(stored) < NOT_ADMIN_CACHE_MS;
  } catch {
    return false;
  }
}

export function writeNotAdminCache(): void {
  try {
    window.sessionStorage.setItem(NOT_ADMIN_CACHE_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the next page just asks again.
  }
}

/** False until whoami confirms an admin session; stays false for anonymous visitors and on any failure. */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (readNotAdminCache()) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), WHOAMI_TIMEOUT_MS);
    fetch(WHOAMI_URL, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        await res.arrayBuffer();
        if (cancelled) return;
        if (res.ok) setIsAdmin(true);
        else writeNotAdminCache();
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timeout));
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  return isAdmin;
}
