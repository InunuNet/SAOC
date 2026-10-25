// Usage: pnpm exec tsx contracts/checks/sec-tickets-status-pdf-limit/check.mts
// GET /api/tickets/status and /api/tickets/pdf must throttle per client IP. Requests carry no
// `ref`, so the handlers answer 404 without touching Firestore until the limiter trips.
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';

import { GET as pdfGet } from '../../../app/api/tickets/pdf/route.ts';
import { GET as statusGet } from '../../../app/api/tickets/status/route.ts';
import { MAX_LINE_ITEMS } from '../../../lib/tickets-constants.ts';
import { consumeRateLimit } from '../../../lib/newsletter-rate-limit.ts';
import { createAttemptStore, scopeAttemptsToRequest } from '../../../lib/newsletter-rate-store.ts';

const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const STATUS_ALLOWED_PER_WINDOW = 120;
const PDF_ALLOWED_PER_WINDOW = 60;
const STATUS_BUYERS_ON_ONE_ADDRESS = 3;
const POLLS_PER_BUYER_PER_MINUTE = 20;
const SECOND_MS = 1000;

type Handler = (request: NextRequest) => Promise<Response>;

function request(path: string, realIp: string, spoofedFirstHop = '198.51.100.1'): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { 'x-forwarded-for': `${spoofedFirstHop}, ${realIp}, 10.0.0.1` },
  });
}

const fails: string[] = [];

async function exercise(name: string, handler: Handler, path: string, allowed: number): Promise<void> {
  for (let i = 1; i <= allowed; i += 1) {
    // A fresh forged first hop every time: the limiter must key on the real client hop.
    const res = await handler(request(path, '203.0.113.7', `192.0.2.${i % 250}`));
    if (res.status !== HTTP_NOT_FOUND) fails.push(`${name} attempt ${i}: expected 404, got ${res.status}`);
  }
  const tripped = await handler(request(path, '203.0.113.7', '192.0.2.250'));
  if (tripped.status !== HTTP_TOO_MANY_REQUESTS) {
    fails.push(`${name} attempt ${allowed + 1}: expected 429, got ${tripped.status}`);
  } else if (!tripped.headers.get('Retry-After')) {
    fails.push(`${name} 429 is missing Retry-After`);
  }
  const other = await handler(request(path, '203.0.113.8'));
  if (other.status !== HTTP_NOT_FOUND) fails.push(`${name} other IP: expected 404, got ${other.status}`);
}

// Caps must clear real use: buyers sharing an address polling, and every position of a full order.
if (STATUS_ALLOWED_PER_WINDOW < STATUS_BUYERS_ON_ONE_ADDRESS * POLLS_PER_BUYER_PER_MINUTE) {
  fails.push('status cap is below normal shared-address polling');
}
if (PDF_ALLOWED_PER_WINDOW <= MAX_LINE_ITEMS + 1) {
  fails.push(`pdf cap ${PDF_ALLOWED_PER_WINDOW} does not clear ${MAX_LINE_ITEMS} positions plus the order PDF`);
}

await exercise('status', statusGet, '/api/tickets/status', STATUS_ALLOWED_PER_WINDOW);
await exercise('pdf', pdfGet as Handler, '/api/tickets/pdf', PDF_ALLOWED_PER_WINDOW);

// The routes size their store above the cap, or the cap could never trip.
for (const route of ['app/api/tickets/status/route.ts', 'app/api/tickets/pdf/route.ts']) {
  const source = readFileSync(new URL(`../../../${route}`, import.meta.url), 'utf8');
  if (!/HISTORY_PER_KEY/.test(source)) fails.push(`${route}: store history not sized for its cap`);
}

// Retry-After: time until enough attempts expire for a retry to pass, not until the oldest one does.
{
  const store = createAttemptStore(60 * SECOND_MS);
  const at = (seconds: number) => new Date(Date.UTC(2026, 9, 25, 10, 0, seconds));
  const hit = (seconds: number) =>
    consumeRateLimit({ now: at(seconds), ...scopeAttemptsToRequest(store) }, 'k', 3, 60 * SECOND_MS);
  hit(0);
  hit(10);
  hit(20);
  const denied = hit(30);
  if (denied.allowed) fails.push('retry-after: 4th attempt should be denied');
  else if (denied.retryAfterSeconds !== 40) {
    fails.push(`retry-after: expected 40s, got ${denied.retryAfterSeconds}s`);
  }
  if (!hit(30 + 40).allowed) fails.push('retry-after: retry after the advertised wait was still denied');
}

if (fails.length > 0) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log('PASS sec-tickets-status-pdf-limit');
