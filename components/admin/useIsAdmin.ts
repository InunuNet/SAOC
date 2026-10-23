'use client';

import { useEffect, useState } from 'react';

// Whether this browser holds a signed-in admin session, asked of /api/admin/whoami after hydration so
// the page itself stays static (no cookies() read, ISR intact). Shared with AdminPill: a negative answer
// is remembered in sessionStorage for ten minutes, so an anonymous visit asks once per window.
const WHOAMI_URL = '/api/admin/whoami';
const NOT_ADMIN_CACHE_KEY = 'saoc-admin-pill-not-admin';
const NOT_ADMIN_CACHE_MS = 10 * 60 * 1000;
const WHOAMI_TIMEOUT_MS = 5000;

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

let inFlight: Promise<boolean> | null = null;

/**
 * Asks whoami once however many callers want the answer: concurrent callers share one request, which is
 * dropped from here as soon as it settles (so the not-admin cache, not this variable, bounds repeats).
 * Resolves false on a refusal, a timeout or any failure.
 */
export function askWhoami(): Promise<boolean> {
  if (inFlight) return inFlight;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), WHOAMI_TIMEOUT_MS);
  inFlight = fetch(WHOAMI_URL, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
    .then(async (res) => {
      // Drain the body: a response nobody reads keeps the request open, which stalls the
      // page's network-idle state (and the e2e specs that wait on it).
      await res.arrayBuffer();
      if (!res.ok) writeNotAdminCache();
      return res.ok;
    })
    .catch(() => false)
    .finally(() => {
      window.clearTimeout(timeout);
      inFlight = null;
    });
  return inFlight;
}

/** False until whoami confirms an admin session; stays false for anonymous visitors and on any failure. */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (readNotAdminCache()) return;
    let cancelled = false;
    void askWhoami().then((ok) => {
      if (!cancelled && ok) setIsAdmin(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}
