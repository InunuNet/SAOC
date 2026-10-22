// footer-newsletter-subscribe -- admin export gating, fail closed. Run: npx tsx <this file>
import { handleNewsletterExport } from '../../../../../../lib/newsletter-handler.ts';

const failures = [];
const check = (name, ok) => { if (!ok) failures.push(name); };
const ROWS = [
  { email: 'a@example.com', source: 'saoc-footer', status: 'subscribed', subscribedAt: new Date('2027-01-05T00:00:00Z'), unsubscribeToken: 'A'.repeat(43) },
  { email: 'gone@example.com', source: 'nos-footer', status: 'unsubscribed', subscribedAt: new Date('2027-01-01T00:00:00Z'), unsubscribeToken: 'G'.repeat(43) },
];
let listed = 0;
const listSubscribers = async () => { listed++; return ROWS; };

const expected = { 'no-session': 401, 'invalid-session': 401, 'no-claim': 403, 'email-unverified': 403, 'not-allowlisted': 403 };
for (const [reason, status] of Object.entries(expected)) {
  const r = await handleNewsletterExport({ origin: 'https://beta.saoc.co.za', getSession: async () => ({ ok: false, reason }), listSubscribers });
  check(`${reason} => ${status}`, r.status === status);
  check(`${reason} leaks nothing`, !String(r.body).includes('@'));
}
check('list never called when refused', listed === 0);

const unknown = await handleNewsletterExport({ origin: 'https://beta.saoc.co.za', getSession: async () => ({ ok: false, reason: 'something-new' }), listSubscribers });
check('unenumerated refusal fails closed', unknown.status === 403 && listed === 0);
const thrown = await handleNewsletterExport({ origin: 'https://beta.saoc.co.za', getSession: async () => { throw new Error('x'); }, listSubscribers }).catch(() => ({ status: 500 }));
check('session throw never exports', thrown.status >= 400 && listed === 0);

const ok = await handleNewsletterExport({ origin: 'https://beta.saoc.co.za', getSession: async () => ({ ok: true, decodedToken: {} }), listSubscribers });
const lines = ok.body.split('\n');
check('ok => 200', ok.status === 200);
check('subscribed only', lines.length === 2 && lines[0] === 'email,source,subscribedAt,unsubscribeUrl' && lines[1].startsWith('a@example.com,') && lines[1].endsWith('https://beta.saoc.co.za/newsletter/unsubscribe?token=' + 'A'.repeat(43)) && !ok.body.includes('gone@') && !ok.body.includes('G'.repeat(43)));
check('csv headers', ok.headers['Content-Type'].startsWith('text/csv') && ok.headers['Content-Disposition'] === 'attachment; filename="newsletter-subscribers.csv"' && ok.headers['Cache-Control'] === 'no-store');

if (failures.length) { console.error('FAIL', failures); process.exit(1); }
console.log('export gate checks pass');
