'use client';

import { useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const VIEW_PARAM = 'view';

/**
 * The open record lives in `?view=<id>` so the browser Back button closes the drawer and a link
 * (the dashboard's "Needs attention" View) can open one directly. History is written with the
 * native API, which Next syncs into useSearchParams without a server round trip.
 */
export function useDrawerParam(): {
  viewId: string | null;
  open: (id: string) => void;
  close: () => void;
} {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const viewId = searchParams.get(VIEW_PARAM);

  const open = useCallback(
    (id: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set(VIEW_PARAM, id);
      window.history.pushState(null, '', `${pathname}?${params.toString()}`);
    },
    [pathname],
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete(VIEW_PARAM);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
  }, [pathname]);

  return { viewId, open, close };
}
