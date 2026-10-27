// footer-newsletter-subscribe -- pure lib checks. Run: npx tsx <this file>
import {
  NEWSLETTER_EMAIL_MAX_LENGTH,
  normaliseNewsletterEmail,
  newsletterDocId,
  generateUnsubscribeToken,
  isWellFormedUnsubscribeToken,
  maskEmail,
  applySubscribe,
  buildSubscribersCsv,
  parseNewsletterTopics,
  subscriberTopics,
} from '../../../../../../lib/newsletter.ts';

const failures = [];
const check = (name, ok) => { if (!ok) failures.push(name); };
const NOW = new Date('2027-01-05T00:00:00Z');

check('max length is 254', NEWSLETTER_EMAIL_MAX_LENGTH === 254);
check('normalise trims+lowercases', normaliseNewsletterEmail('  Jane@Example.COM ') === 'jane@example.com');
for (const bad of [undefined, null, 5, '', 'nope', 'a@b', 'a b@c.de', '=cmd@x.com', '+a@x.com', '-a@x.com', '@a@x.com', 'a'.repeat(250) + '@x.com']) {
  check(`rejects ${JSON.stringify(bad)}`, normaliseNewsletterEmail(bad) === null);
}
check('accepts 254-char boundary', normaliseNewsletterEmail('a'.repeat(242) + '@example.com')?.length === 254);

const id1 = newsletterDocId('jane@example.com');
check('docId deterministic', id1 === newsletterDocId('jane@example.com'));
check('docId 64 hex', /^[0-9a-f]{64}$/.test(id1));
check('docId differs per email', id1 !== newsletterDocId('june@example.com'));

const tokens = new Set(Array.from({ length: 2000 }, () => generateUnsubscribeToken()));
check('2000 unique tokens', tokens.size === 2000);
check('tokens well formed', [...tokens].every((t) => /^[A-Za-z0-9_-]{43}$/.test(t) && isWellFormedUnsubscribeToken(t)));
check('malformed token rejected', !isWellFormedUnsubscribeToken('short') && !isWellFormedUnsubscribeToken(42) && !isWellFormedUnsubscribeToken('a'.repeat(44)));

const masked = maskEmail('jane@example.com');
check('mask hides local part', !masked.includes('jane') && masked.endsWith('@example.com'));

const input = { email: 'jane@example.com', source: 'saoc-footer', now: NOW, token: 'T'.repeat(43) };
const created = applySubscribe(null, input);
check('new doc fields', created && created.status === 'subscribed' && created.subscribedAt.getTime() === NOW.getTime() && created.unsubscribedAt === null && created.unsubscribeToken === input.token && created.source === 'saoc-footer' && created.email === input.email);
const merged = applySubscribe(created, { ...input, token: 'X'.repeat(43), source: 'nos-footer' });
check('existing subscribed merges without changing identity', merged && JSON.stringify(merged.topics) === '["saoc","nos"]' && merged.unsubscribeToken === created.unsubscribeToken && merged.source === created.source);
check('existing subscribed with no new topic => null', applySubscribe(created, input) === null);
const later = new Date('2027-02-01T00:00:00Z');
const unsub = { ...created, status: 'unsubscribed', unsubscribedAt: new Date('2027-01-10T00:00:00Z') };
const resub = applySubscribe(unsub, { ...input, now: later, token: 'X'.repeat(43), source: 'nos-footer' });
check('resubscribe flips', resub && resub.status === 'subscribed' && resub.unsubscribedAt === null && resub.subscribedAt.getTime() === later.getTime());
check('resubscribe keeps token+source', resub && resub.unsubscribeToken === created.unsubscribeToken && resub.source === 'saoc-footer');
check('legacy request defaults to source topic', JSON.stringify(created.topics) === '["saoc"]');
check('legacy document derives source topic', JSON.stringify(subscriberTopics(undefined, 'nos-footer')) === '["nos"]');
check('topics canonicalised', JSON.stringify(parseNewsletterTopics(['nos', 'saoc', 'nos'], 'saoc-footer')) === '["saoc","nos"]');
check('empty and unknown topics rejected', parseNewsletterTopics([], 'saoc-footer') === null && parseNewsletterTopics(['unknown'], 'saoc-footer') === null);
check('resubscribe takes only the requested topics (consent)', JSON.stringify(resub.topics) === '["nos"]');
for (const doc of [created, resub]) {
  check('no undefined own props', doc && Object.values(doc).every((v) => v !== undefined));
}

const csv = buildSubscribersCsv([
  { email: 'a@example.com', source: 'saoc-footer', subscribedAt: NOW, unsubscribeToken: 'A'.repeat(43) },
  { email: '=HYPERLINK@example.com', source: 'nos-footer', subscribedAt: null, unsubscribeToken: 'B'.repeat(43) },
  { email: 'c,d@example.com', source: 'nos-footer', subscribedAt: NOW, unsubscribeToken: 'C'.repeat(43) },
  { email: 'both@example.com', source: 'saoc-footer', topics: ['nos', 'saoc'], subscribedAt: NOW, unsubscribeToken: 'D'.repeat(43) },
], 'https://beta.saoc.co.za').split('\n');
check('csv header', csv[0] === 'email,source,subscribedAt,unsubscribeUrl,topics');
check('csv iso timestamp', csv[1] === 'a@example.com,saoc-footer,2027-01-05T00:00:00.000Z,https://beta.saoc.co.za/newsletter/unsubscribe?token=' + 'A'.repeat(43) + ',saoc');
check('csv formula guard', csv[2].startsWith("'=") );
check('csv url per row', csv[2].includes('?token=' + 'B'.repeat(43)) && csv[3].includes('?token=' + 'C'.repeat(43)));
check('csv legacy topics', csv[2].endsWith(',nos'));
check('csv topics use canonical order and semicolon', csv[4].endsWith(',saoc;nos'));
check('csv quoting', csv[3].startsWith('"c,d@example.com"'));

if (failures.length) { console.error('FAIL', failures); process.exit(1); }
console.log('newsletter lib checks pass');
