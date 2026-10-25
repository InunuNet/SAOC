// Usage: pnpm exec tsx contracts/checks/sec-tickets-status-pdf-limit/check.mts
// GET /api/tickets/status and /api/tickets/pdf must throttle per client IP. Requests carry no
// `ref`, so the handlers answer 404 without touching Firestore until the limiter trips.
import { NextRequest } from 'next/server';

import { GET as pdfGet } from '../../../app/api/tickets/pdf/route.ts';
import { GET as statusGet } from '../../../app/api/tickets/status/route.ts';

const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const STATUS_ALLOWED_PER_WINDOW = 40;
const PDF_ALLOWED_PER_WINDOW = 10;

type Handler = (request: NextRequest) => Promise<Response>;

function request(path: string, ip: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` },
  });
}

const fails: string[] = [];

async function exercise(name: string, handler: Handler, path: string, allowed: number): Promise<void> {
  for (let i = 1; i <= allowed; i += 1) {
    const res = await handler(request(path, '203.0.113.7'));
    if (res.status !== HTTP_NOT_FOUND) fails.push(`${name} attempt ${i}: expected 404, got ${res.status}`);
  }
  const tripped = await handler(request(path, '203.0.113.7'));
  if (tripped.status !== HTTP_TOO_MANY_REQUESTS) {
    fails.push(`${name} attempt ${allowed + 1}: expected 429, got ${tripped.status}`);
  } else if (!tripped.headers.get('Retry-After')) {
    fails.push(`${name} 429 is missing Retry-After`);
  }
  const other = await handler(request(path, '203.0.113.8'));
  if (other.status !== HTTP_NOT_FOUND) fails.push(`${name} other IP: expected 404, got ${other.status}`);
}

await exercise('status', statusGet, '/api/tickets/status', STATUS_ALLOWED_PER_WINDOW);
await exercise('pdf', pdfGet as Handler, '/api/tickets/pdf', PDF_ALLOWED_PER_WINDOW);

if (fails.length > 0) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log('PASS sec-tickets-status-pdf-limit');
