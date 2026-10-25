// A4 -- /tickets/[slug] returns notFound() for a demo product in the public context (production
// NODE_ENV), and still renders it for local QA (development). Calls the server component
// directly, offline under _mocks/register.cjs; notFound() surfaces as a thrown error whose digest
// is NEXT_HTTP_ERROR_FALLBACK;404.
//   node --require ./contracts/checks/ticket-onsale-predicate/_mocks/register.cjs --import tsx <this file>
import { finish } from './_golden.mts';

process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'stubproject';
process.env.NEXT_PUBLIC_NOS_SITE_URL = 'https://nos.example.test';
process.env.NEXT_PUBLIC_SAOC_SITE_URL = 'https://saoc.example.test';
const page = await import('../../../app/(nos)/tickets/[slug]/page.tsx');
const Page = page.default as (p: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string>> }) => Promise<unknown>;
const failures: string[] = [];

async function outcome(slug: string, nodeEnv: string): Promise<'404' | 'rendered' | string> {
  (process.env as Record<string, string>).NODE_ENV = nodeEnv;
  try {
    await Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
    return 'rendered';
  } catch (e) {
    const digest = (e as { digest?: string }).digest ?? '';
    return digest.includes('404') ? '404' : `threw ${String(e).slice(0, 120)}`;
  }
}

for (const slug of ['qa-fixture-ticket', 'fictional-test-show-general-admission', 'demo-general-admission']) {
  const got = await outcome(slug, 'production');
  if (got !== '404') failures.push(`production, /tickets/${slug}: expected 404, got ${got}`);
}
// Controls: a real product renders in production; the fixture renders in development.
{
  const got = await outcome('weekend-pass', 'production');
  if (got !== 'rendered') failures.push(`control production /tickets/weekend-pass: expected rendered, got ${got}`);
  const dev = await outcome('qa-fixture-ticket', 'development');
  if (dev !== 'rendered') failures.push(`control development /tickets/qa-fixture-ticket: expected rendered, got ${dev}`);
  const missing = await outcome('no-such-ticket', 'production');
  if (missing !== '404') failures.push(`control nonexistent slug: expected 404, got ${missing}`);
}
const attempts = (globalThis.__networkAttempts as string[] | undefined) ?? [];
if (attempts.length > 0) failures.push(`network attempted despite the offline harness: ${attempts.join(' | ')}`);
finish('A4 detail page 404s demo in public mode', failures);
