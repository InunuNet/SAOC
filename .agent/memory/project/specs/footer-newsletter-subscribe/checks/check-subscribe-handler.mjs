// footer-newsletter-subscribe -- subscribe handler. Run: npx tsx <this file>
import { handleNewsletterSubscribe, NEWSLETTER_RATE_LIMIT_MAX_ATTEMPTS } from '../../../../../../lib/newsletter-handler.ts';
import { makeDeps } from './_fakes.mjs';

const failures = [];
const check = (name, ok) => { if (!ok) failures.push(name); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const body = (email, extra = {}) => ({ email, source: 'saoc-footer', ...extra });
const run = (b, d, key = 'ip:1') => handleNewsletterSubscribe({ body: b, rateLimitKey: key }, d);

// idempotent + enumeration-safe: new, repeat, resubscribe-after-unsubscribe all identical
{
  const { deps, store, calls } = makeDeps();
  const r1 = await run(body('Jane@Example.com'), deps, 'ip:a');
  const r2 = await run(body('jane@example.com'), deps, 'ip:b');
  check('one doc after two subscribes', store.size === 1);
  check('second subscribe wrote nothing', calls.write === 1);
  check('new vs existing identical response', r1.status === 200 && same(r1, r2));
  const [id, doc] = [...store][0];
  check('doc shape', doc.status === 'subscribed' && doc.source === 'saoc-footer' && doc.unsubscribedAt === null && doc.email === 'jane@example.com' && /^[0-9a-f]{64}$/.test(id));
  store.set(id, { ...doc, status: 'unsubscribed', unsubscribedAt: new Date() });
  const r3 = await run(body('jane@example.com'), deps, 'ip:c');
  check('resubscribe response identical', same(r1, r3));
  check('resubscribe flipped back', store.get(id).status === 'subscribed' && store.get(id).unsubscribedAt === null && store.size === 1);
  check('success body', same(r1.body, { success: true }));
  check('old request shape preserved', same(r1, { status: 200, body: { success: true } }));
  const r4 = await run(body('jane@example.com', { topics: ['nos', 'saoc', 'nos'] }), deps, 'ip:d');
  check('existing subscribed merges and orders topics', r4.status === 200 && same(store.get(id).topics, ['saoc', 'nos']));
  check('existing merge keeps token and source', store.get(id).unsubscribeToken === doc.unsubscribeToken && store.get(id).source === doc.source);
}

// validation
{
  const { deps, calls } = makeDeps();
  for (const [i, b] of [body('nope'), body(''), body(undefined), body('a'.repeat(250) + '@x.com'), null, 'str', 42].entries()) {
    const r = await run(b, deps, `ip:v${i}`);
    check(`invalid case ${i} => 400`, r.status === 400 && typeof r.body.error === 'string');
  }
  const r = await run(body('jane@example.com', { source: 'evil' }), deps, 'ip:s');
  check('bad source => 400', r.status === 400);
  for (const [i, topics] of [[], ['unknown'], ['saoc', 'unknown'], 'saoc', null].entries()) {
    const invalid = await run(body('jane@example.com', { topics }), deps, `ip:t${i}`);
    check(`bad topics ${i} => 400`, invalid.status === 400 && invalid.body.field === 'topics');
  }
  const r2 = await run(body('nope'), deps, 'ip:e');
  check('invalid email names the field', r2.body.field === 'email');
  check('no store access on invalid input', calls.get === 0 && calls.write === 0);
}

// honeypot: 200 identical to success, zero store calls
{
  const { deps, calls } = makeDeps();
  const ok = await run(body('jane@example.com'), makeDeps().deps, 'ip:h0');
  const r = await run(body('bot@example.com', { _hp: 'gotcha' }), deps, 'ip:h');
  check('honeypot looks like success', r.status === 200 && same(r.body, ok.body));
  check('honeypot writes nothing', calls.get === 0 && calls.write === 0);
}

// rate limit shields the write
{
  const { deps, calls } = makeDeps();
  let last;
  for (let i = 0; i < NEWSLETTER_RATE_LIMIT_MAX_ATTEMPTS; i++) last = await run(body(`u${i}@example.com`), deps, 'ip:r');
  check('under limit ok', last.status === 200);
  const writesBefore = calls.write;
  const blocked = await run(body('over@example.com'), deps, 'ip:r');
  check('over limit => 429', blocked.status === 429 && typeof blocked.retryAfterSeconds === 'number');
  check('429 touches no store', calls.write === writesBefore && calls.get === NEWSLETTER_RATE_LIMIT_MAX_ATTEMPTS);
  const other = await run(body('x@example.com'), deps, 'ip:other');
  check('other key unaffected', other.status === 200);
}

// write failure => 500, logs carry no raw email
{
  const { deps, calls } = makeDeps({ writeSubscriber: async () => { throw new Error('boom'); } });
  const r = await run(body('secret.person@example.com'), deps, 'ip:f');
  check('write failure => 500', r.status === 500 && typeof r.body.error === 'string');
  check('error logged', calls.logs.length > 0);
  check('no raw email / local part in logs', calls.logs.every((l) => !l.includes('secret.person') && !l.includes('secret.person@example.com')));
}

if (failures.length) { console.error('FAIL', failures); process.exit(1); }
console.log('subscribe handler checks pass');
