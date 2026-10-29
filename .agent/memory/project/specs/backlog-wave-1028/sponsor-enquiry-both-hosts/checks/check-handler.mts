// sponsor-enquiry-both-hosts F2 (items 2+3): the real handler + doc builder, injected deps, no Firestore, no email.
// PIN lines pass on main by design (they guard the existing form against the fix); RED lines fail on main.
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import { buildSponsorEnquiryDoc, type SponsorEnquiryDoc, type SponsorEnquirySite } from '@/lib/sponsor-enquiry.ts';
import { handleSponsorEnquiry, type SponsorEnquiryDeps } from '@/lib/sponsor-enquiry-handler.ts';

const failures: string[] = [];
const expect = (ok: boolean, label: string) => { if (!ok) failures.push(label); };

const NOW = new Date('2026-10-28T10:00:00Z');
const VALID = { contactName: 'E2E Tester', email: 'Tester@Example.com', message: 'We would like to sponsor.', consent: true };

function deps(over: Partial<SponsorEnquiryDeps> = {}) {
  const written: SponsorEnquiryDoc[] = [];
  const committed: string[] = [];
  const logs: Array<{ message: string; context: Record<string, string> }> = [];
  const attempts: Array<{ key: string; at: Date }> = [];
  const d: SponsorEnquiryDeps = {
    now: NOW,
    getPriorAttempts: () => attempts,
    recordAttempt: (key, at) => { attempts.push({ key, at }); },
    writeEnquiry: async (doc) => { written.push(doc); return 'doc-1'; },
    afterCommit: async (id) => { committed.push(id); },
    logError: (message, context) => { logs.push({ message, context }); },
    ...over,
  };
  return { d, written, committed, logs };
}
const run = (body: unknown, site: SponsorEnquirySite, d: SponsorEnquiryDeps, extra: Record<string, unknown> = {}) =>
  handleSponsorEnquiry({ body, rateLimitKey: 'k', site, ...extra }, d);

// PIN validation: required fields, 400 with fieldErrors, nothing written.
{
  const t = deps();
  const r = await run({}, 'saoc', t.d);
  const fe = (r.body.fieldErrors ?? {}) as Record<string, string>;
  expect(r.status === 400 && ['contactName', 'email', 'message', 'consent'].every((k) => k in fe), 'PIN empty body -> 400 with contactName/email/message/consent errors');
  expect(t.written.length === 0, 'PIN invalid body writes nothing');
  expect((await run({ ...VALID, email: 'nope' }, 'saoc', t.d)).status === 400, 'PIN bad email -> 400');
  expect((await run({ ...VALID, consent: 'true' }, 'saoc', t.d)).status === 400, 'PIN consent must be boolean true');
  expect((await run(VALID, 'saoc', t.d, { malformed: true })).status === 400, 'PIN malformed JSON -> 400');
}
// PIN honeypot: looks like success, writes nothing.
{
  const t = deps();
  const r = await run({ ...VALID, _hp: 'bot' }, 'saoc', t.d);
  expect(r.status === 201 && t.written.length === 0, 'PIN honeypot -> 201 and no write');
}
// PIN write shape: optionals are null never undefined, status new, lower-cased email, source from the server-supplied site.
{
  const t = deps();
  const r = await run(VALID, 'nos', t.d);
  const doc = t.written[0];
  expect(r.status === 201 && t.written.length === 1 && t.committed[0] === 'doc-1', 'PIN valid -> 201, one write, afterCommit gets the id');
  if (doc) {
    for (const k of ['organisation', 'phone', 'website', 'level'] as const) expect(Object.hasOwn(doc, k) && doc[k] === null, `PIN doc.${k} is an own null property`);
    expect(!Object.values(doc).includes(undefined as never), 'PIN doc has no undefined value');
    expect(doc.status === 'new' && doc.email === 'tester@example.com' && doc.consent === true && doc.submittedAt === NOW, 'PIN doc status/email/consent/submittedAt');
    expect(doc.source === 'nos', 'PIN doc.source is the host-derived site (nos)');
  }
}
// PIN the client cannot choose the site: a body source/site/host is ignored.
{
  const t = deps();
  await run({ ...VALID, source: 'nos', site: 'nos', host: 'nos.saoc.co.za' }, 'saoc', t.d);
  expect(t.written[0]?.source === 'saoc', 'PIN body-supplied source/site/host cannot override the server site');
}
// RED allowlist: a site outside saoc|nos is stored as null, never echoed (item 2).
{
  const t = deps();
  await run(VALID, 'evil.example' as SponsorEnquirySite, t.d);
  expect(t.written[0] !== undefined && Object.hasOwn(t.written[0], 'source') && t.written[0].source === null, 'RED unknown site stores source null (allowlist saoc|nos)');
  const direct = buildSponsorEnquiryDoc({ contactName: 'a', organisation: null, email: 'a@b.co', phone: null, website: null, level: null, message: 'ten chars!!', consent: true }, 'x' as SponsorEnquirySite, NOW);
  expect(direct.source === null, 'RED buildSponsorEnquiryDoc coerces an unknown site to null');
  const ok = buildSponsorEnquiryDoc({ contactName: 'a', organisation: null, email: 'a@b.co', phone: null, website: null, level: null, message: 'ten chars!!', consent: true }, 'saoc', NOW);
  expect(ok.source === 'saoc', 'PIN buildSponsorEnquiryDoc keeps saoc');
}
// PIN failure isolation: write failure -> 500, nothing sent; notification failure -> still 201, logged without the message.
{
  const t = deps({ writeEnquiry: async () => { throw new Error('boom contains a@b.co'); } });
  const r = await run(VALID, 'saoc', t.d);
  expect(r.status === 500 && t.committed.length === 0, 'PIN write failure -> 500, no notification');
  expect(t.logs.every((l) => !JSON.stringify(l).includes('a@b.co')), 'PIN write-failure log carries no error message text');
  const n = deps({ afterCommit: async () => { throw new Error('mailer down tester@example.com'); } });
  const r2 = await run(VALID, 'saoc', n.d);
  expect(r2.status === 201 && n.written.length === 1, 'PIN notification failure still 201 with the doc stored');
  expect(n.logs.length === 1 && n.logs[0]?.context.operation === 'notify' && !JSON.stringify(n.logs).includes('tester@example.com'), 'PIN notify failure logged as operation+exceptionType only');
}
// PIN rate limit: the 6th attempt in the window is 429 with a retry delay.
{
  const t = deps();
  let last = { status: 0, retryAfterSeconds: undefined as number | undefined };
  for (let i = 0; i < 6; i += 1) last = await run(VALID, 'saoc', t.d);
  expect(last.status === 429 && typeof last.retryAfterSeconds === 'number', 'PIN 6th attempt -> 429 with retryAfterSeconds');
}

if (failures.length) { console.error(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('PASS: handler validation, write shape, site allowlist, failure isolation, rate limit');
