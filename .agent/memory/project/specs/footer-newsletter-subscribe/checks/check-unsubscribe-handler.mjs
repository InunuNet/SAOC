// footer-newsletter-subscribe -- unsubscribe handler. Run: npx tsx <this file>
import { handleNewsletterSubscribe, handleNewsletterUnsubscribe } from '../../../../../../lib/newsletter-handler.ts';
import { makeDeps } from './_fakes.mjs';

const failures = [];
const check = (name, ok) => { if (!ok) failures.push(name); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const unsub = (token, d, key = 'ip:u') => handleNewsletterUnsubscribe({ body: { token }, rateLimitKey: key }, d);

const { deps, store, calls } = makeDeps();
await handleNewsletterSubscribe({ body: { email: 'jane@example.com', source: 'nos-footer' }, rateLimitKey: 'ip:s' }, deps);
const [id, doc] = [...store][0];

const bad1 = await unsub('short', deps, 'ip:1');
const bad2 = await unsub('Z'.repeat(43), deps, 'ip:2');
const bad3 = await handleNewsletterUnsubscribe({ body: {}, rateLimitKey: 'ip:3' }, deps);
check('malformed/unknown/missing token => identical 400', bad1.status === 400 && same(bad1, bad2) && same(bad2, bad3));
check('malformed token never reaches lookup', calls.find === 1);
check('bad tokens change nothing', store.get(id).status === 'subscribed' && calls.mark === 0);

const ok = await unsub(doc.unsubscribeToken, deps, 'ip:4');
check('valid token => 200', ok.status === 200 && same(ok.body, { success: true }));
check('doc unsubscribed', store.get(id).status === 'unsubscribed' && store.get(id).unsubscribedAt instanceof Date);
const again = await unsub(doc.unsubscribeToken, deps, 'ip:5');
check('repeat is idempotent 200 with no extra write', again.status === 200 && calls.mark === 1);

// rate limiting moved to the route (durable Firestore limiter, lib/abuse-limiter.ts, SEC-15).
const rl = makeDeps();
let last;
for (let i = 0; i < 12; i++) last = await unsub('Z'.repeat(43), rl.deps, 'ip:rl');
check('handler itself never rate limits', last.status === 400);

if (failures.length) { console.error('FAIL', failures); process.exit(1); }
console.log('unsubscribe handler checks pass');
