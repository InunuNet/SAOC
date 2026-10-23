import { NextResponse } from 'next/server';

import type { NewsletterHandlerResult } from '@/lib/newsletter-handler';

/** Route plumbing shared by the newsletter POST routes: the JSON answer and the response-time floor. */

export function toNewsletterResponse(result: NewsletterHandlerResult): NextResponse {
  const headers: Record<string, string> = {};
  if (result.retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return NextResponse.json(result.body, { status: result.status, headers });
}

// Holds a successful answer until `floorMs` have passed since `startedAt`, so the time taken does
// not reveal which branch ran. Approximate by design.
export async function padToFloor(startedAt: number, floorMs: number): Promise<void> {
  const remaining = floorMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}
