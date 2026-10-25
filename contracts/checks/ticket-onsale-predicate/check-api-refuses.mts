// A3 -- POST /api/tickets/checkout refuses a demo product, whatever the client sends, with the
// route's existing error shape ({ error: string }, 400 "Unknown ticketType: <slug>", the same
// response a nonexistent slug gets, so a refusal never confirms a fixture exists), and writes
// nothing. Runs offline under _mocks/register.mjs: Sanity answers from goldens/catalogue.json,
// Firestore is a stub that counts writes. NODE_ENV is set per case because the policy reads it
// at request time.
//   node --import tsx --import ./contracts/checks/ticket-onsale-predicate/_mocks/register.mjs <this file>
import { finish } from './_golden.mts';

process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'stubproject';
process.env.NEXT_PUBLIC_NOS_SITE_URL = 'https://nos.example.test';
process.env.NEXT_PUBLIC_SAOC_SITE_URL = 'https://saoc.example.test';
// Placeholder sandbox values so the gateway readiness gate passes; nothing is ever sent anywhere.
for (const key of ['OZOW_SANDBOX_SITE_CODE', 'OZOW_SANDBOX_PRIVATE_KEY', 'OZOW_SANDBOX_API_KEY']) {
  process.env[key] = 'offline-stub';
}
const { POST } = await import('../../../app/api/tickets/checkout/route.ts');
const { NATIONAL_SHOW_ID } = await import('../../../lib/tickets-constants.ts');
const failures: string[] = [];
let n = 0;

async function call(slug: string, nodeEnv: string) {
  (process.env as Record<string, string>).NODE_ENV = nodeEnv;
  globalThis.__fsWrites = 0;
  n += 1;
  const req = new Request('http://localhost/api/tickets/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` },
    body: JSON.stringify({
      showId: NATIONAL_SHOW_ID,
      lineItems: [{ ticketType: slug, attendeeName: 'Test Buyer', attendeeEmail: 'buyer@example.com' }],
    }),
  });
  const res = await POST(req as never);
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return { status: res.status, error: String(json?.error ?? ''), writes: (globalThis.__fsWrites as number) ?? 0 };
}

for (const slug of ['qa-fixture-ticket', 'fictional-test-show-general-admission', 'demo-general-admission']) {
  const r = await call(slug, 'production');
  if (r.status !== 400 || !/^Unknown ticketType: /.test(r.error)) {
    failures.push(`production, ${slug}: expected 400 "Unknown ticketType", got ${r.status} ${JSON.stringify(r.error)}`);
  }
  if (r.writes !== 0) failures.push(`production, ${slug}: ${r.writes} Firestore write(s) attempted`);
}
// Nonexistent slug: the shape a refusal must be indistinguishable from.
{
  const r = await call('no-such-ticket', 'production');
  if (r.status !== 400 || !/^Unknown ticketType: /.test(r.error)) failures.push(`control nonexistent slug: got ${r.status} ${JSON.stringify(r.error)}`);
}
// CONTROL 1: a real product is not refused as unknown/demo; it must walk past the product loop
// (the stub Firestore then rejects the reservation write, which is fine: not a 400-unknown).
{
  const r = await call('weekend-pass', 'production');
  if (r.status === 400 && /^Unknown ticketType: /.test(r.error)) failures.push('control weekend-pass: refused as unknown, the predicate is over-blocking');
}
// CONTROL 2 (e2e suite keeps working): outside production, with payments not live, the QA
// fixture is NOT refused, so contracts/checks/ticketing-hardening/* and local runs still work.
{
  const r = await call('qa-fixture-ticket', 'development');
  if (r.status === 400 && /^Unknown ticketType: /.test(r.error)) failures.push('development, qa-fixture-ticket: refused, the non-production QA path is broken');
}
const unhandled = (globalThis.__unhandledQueries as string[] | undefined) ?? [];
if (unhandled.length > 0) failures.push(`harness drift, unhandled Sanity queries: ${unhandled.join(' | ')}`);
const attempts = (globalThis.__networkAttempts as string[] | undefined) ?? [];
if (attempts.length > 0) failures.push(`network attempted despite the offline harness: ${attempts.join(' | ')}`);
finish('A3 checkout refuses demo, offline', failures);
