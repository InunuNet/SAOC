// lib/request-site.ts
// Mission nos-site-split F1 — which site the current request is for, read from the request headers.
// Server-only (next/headers); proxy.ts, which runs on the Edge, classifies the host itself with the
// same siteForHost() so both agree. Calling this makes a route dynamic.
import { headers } from 'next/headers';

import { siteForHost, type Site } from '@/lib/site-hosts';

export async function requestSite(): Promise<Site> {
  const requestHeaders = await headers();
  return siteForHost(requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'));
}
