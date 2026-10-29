// Offline checks for newsletter-resubscribe-topics. Usage: tsx check.mjs <case>. SAOC_ROOT overrides the repo root.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.SAOC_ROOT ?? process.cwd();
const nl = await import(pathToFileURL(join(root, 'lib/newsletter.ts')).href);
const NOW = new Date('2026-10-26T08:00:00Z');
const TOKEN = 'T'.repeat(43);
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exit(1); };
const doc = (over) => ({
  email: 'a@example.com', status: 'subscribed', source: 'saoc-footer', topics: ['saoc', 'nos'],
  subscribedAt: new Date('2026-09-01T00:00:00Z'), unsubscribedAt: null, unsubscribeToken: TOKEN, ...over,
});
const apply = (existing, topics, source = 'saoc-footer') =>
  nl.applySubscribe(existing, { email: 'a@example.com', source, topics, now: NOW, token: 'N'.repeat(43) });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const cases = {
  'resub-takes-requested-only'() {
    const r = apply(doc({ status: 'unsubscribed', unsubscribedAt: new Date('2026-09-02T00:00:00Z') }), ['saoc']);
    if (!r || !same(r.topics, ['saoc'])) fail(`re-subscribe with [saoc] must store [saoc], got ${JSON.stringify(r && r.topics)}`);
  },
  'resub-default-topic-from-source'() {
    const r = apply(doc({ status: 'unsubscribed', unsubscribedAt: new Date(), topics: ['saoc', 'nos'] }), undefined, 'nos-footer');
    if (!r || !same(r.topics, ['nos'])) fail(`re-subscribe via nos-footer with no topics must store [nos], got ${JSON.stringify(r && r.topics)}`);
  },
  'resub-legacy-doc-no-topics'() {
    const r = apply(doc({ status: 'unsubscribed', unsubscribedAt: new Date(), topics: undefined, source: 'nos-footer' }), ['saoc']);
    if (!r || !same(r.topics, ['saoc'])) fail(`legacy doc re-subscribe with [saoc] must store [saoc], got ${JSON.stringify(r && r.topics)}`);
  },
  'guard-resub-keeps-identity'() {
    const r = apply(doc({ status: 'unsubscribed', unsubscribedAt: new Date(), source: 'nos-footer' }), ['saoc', 'nos']);
    if (!r) fail('re-subscribe returned null');
    if (r.status !== 'subscribed' || r.unsubscribedAt !== null) fail('status/unsubscribedAt not reset');
    if (r.unsubscribeToken !== TOKEN) fail('original unsubscribe token must be kept');
    if (r.source !== 'nos-footer') fail('original source must be kept');
    if (r.subscribedAt !== NOW) fail('subscribedAt must be now');
    if (!same(r.topics, ['saoc', 'nos'])) fail(`explicit both topics must be stored, got ${JSON.stringify(r.topics)}`);
  },
  'guard-subscribed-union-unchanged'() {
    const added = apply(doc({ topics: ['saoc'] }), ['nos']);
    if (!added || !same(added.topics, ['saoc', 'nos'])) fail(`already-subscribed adding nos must union, got ${JSON.stringify(added && added.topics)}`);
    if (apply(doc({ topics: ['saoc'] }), ['saoc']) !== null) fail('already-subscribed, no change, must return null');
    const fresh = apply(null, ['nos']);
    if (!fresh || !same(fresh.topics, ['nos']) || fresh.status !== 'subscribed') fail('new subscriber must store requested topics');
  },
};

const name = process.argv[2];
if (!cases[name]) fail(`unknown case ${name}`);
await cases[name]();
console.log(`ok ${name}`);
