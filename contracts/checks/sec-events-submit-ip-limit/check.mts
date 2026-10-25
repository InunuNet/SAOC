// Usage: pnpm exec tsx contracts/checks/sec-events-submit-ip-limit/check.mts
// POST /api/events/submit must throttle per client IP (uids are free to mint), ahead of auth.
import { NextRequest } from 'next/server';

import { POST } from '../../../app/api/events/submit/route.ts';
import { PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS } from '../../../lib/public-form-rate-limit.ts';

const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;

function post(ip: string): Promise<Response> {
  const headers = { 'x-forwarded-for': `${ip}, 10.0.0.1` };
  return POST(new NextRequest('http://localhost/api/events/submit', { method: 'POST', headers }));
}

const fails: string[] = [];
for (let i = 1; i <= PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS; i += 1) {
  const res = await post('203.0.113.7');
  if (res.status !== HTTP_UNAUTHORIZED) fails.push(`attempt ${i}: expected 401, got ${res.status}`);
}
const tripped = await post('203.0.113.7');
if (tripped.status !== HTTP_TOO_MANY_REQUESTS) {
  fails.push(`attempt ${PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS + 1}: expected 429, got ${tripped.status}`);
} else if (!tripped.headers.get('Retry-After')) {
  fails.push('429 is missing Retry-After');
}
const other = await post('203.0.113.8');
if (other.status !== HTTP_UNAUTHORIZED) fails.push(`other IP: expected 401, got ${other.status}`);

if (fails.length > 0) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log('PASS sec-events-submit-ip-limit');
