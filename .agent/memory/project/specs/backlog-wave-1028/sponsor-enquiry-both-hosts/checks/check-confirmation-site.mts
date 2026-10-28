// sponsor-enquiry-both-hosts D2 (NOS Design P1): the visitor acknowledgement follows the SUBMISSION host. An SAOC-host
// submission uses the SAOC sender and site and an SAOC subject; a NOS-host submission uses the NOS sender and site and a NOS
// subject. It is a bug fix on the existing email, not a new email: one send, to the submitted address, same body copy.
// Interface the dev implements: sendSponsorEnquiryConfirmationEmail({ contactName, email, site }, { mailer }), site: Site
// ('saoc' | 'nos'); the route passes the stored doc's source, with null meaning 'saoc'. No sender is read from the client.
// RED lines fail on main (it always sends the NOS sender with site 'nos'); PIN lines pass on main.
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { FORMS_FROM_ADDRESS, NOS_FORMS_FROM_ADDRESS } from '@/lib/email';
import { sendSponsorEnquiryConfirmationEmail } from '@/lib/sponsor-enquiry-confirmation';

const failures: string[] = [];
const expect = (ok: boolean, label: string) => { if (!ok) failures.push(label); };

type Sent = { to: string; subject: string; react: unknown; from?: string; site?: string };
const capture = () => { const sent: Sent[] = []; return { sent, mailer: { send: async (a: Sent) => { sent.push(a); } } }; };
const send = (input: Record<string, unknown>, mailer: ReturnType<typeof capture>['mailer']) =>
  (sendSponsorEnquiryConfirmationEmail as (i: unknown, d: unknown) => Promise<void>)(input, { mailer });

const saoc = capture();
await send({ contactName: 'Visitor', email: 'visitor@example.com', site: 'saoc' }, saoc.mailer);
const nos = capture();
await send({ contactName: 'Visitor', email: 'visitor@example.com', site: 'nos' }, nos.mailer);

// PIN one send each, to the submitted address only.
expect(saoc.sent.length === 1 && nos.sent.length === 1, 'PIN exactly one acknowledgement per submission');
expect(saoc.sent[0]?.to === 'visitor@example.com' && nos.sent[0]?.to === 'visitor@example.com', 'PIN acknowledgement goes to the submitted address');
// RED SAOC host: SAOC sender, site 'saoc', SAOC subject.
expect(saoc.sent[0]?.from === FORMS_FROM_ADDRESS, 'RED saoc submission is sent from FORMS_FROM_ADDRESS (the SAOC sender)');
expect(saoc.sent[0]?.site === 'saoc', "RED saoc submission passes site 'saoc' (reply-to follows the site)");
expect(/\bSAOC\b/.test(saoc.sent[0]?.subject ?? '') && !/National Orchid Show/.test(saoc.sent[0]?.subject ?? ''), 'PIN saoc subject names SAOC only');
// PIN NOS host keeps the NOS sender and site; RED its subject no longer says SAOC.
expect(nos.sent[0]?.from === NOS_FORMS_FROM_ADDRESS && nos.sent[0]?.site === 'nos', 'PIN nos submission uses NOS_FORMS_FROM_ADDRESS and site nos');
expect(/National Orchid Show/.test(nos.sent[0]?.subject ?? '') && !/\bSAOC\b/.test(nos.sent[0]?.subject ?? ''), 'RED nos subject names the National Orchid Show and not SAOC');
// The email's own preview text follows the site too.
const html = (m?: Sent) => renderToStaticMarkup(m?.react as never);
expect(!html(nos.sent[0]).includes('enquiry — SAOC'), 'RED nos email preview does not say "— SAOC"');
expect(html(saoc.sent[0]).includes('enquiry — SAOC'), 'PIN saoc email preview still says "— SAOC"');
// PIN body copy is unchanged for both (no new visitor wording).
for (const m of [saoc.sent[0], nos.sent[0]]) expect(html(m).includes('Sponsorship enquiry received') && html(m).includes('Thank you for your interest in sponsoring.'), 'PIN acknowledgement body copy unchanged');
// PIN no site given defaults to the SAOC identity (a null stored source, or an old caller).
const dflt = capture();
await send({ contactName: 'Visitor', email: 'visitor@example.com' }, dflt.mailer);
expect(dflt.sent[0]?.from === FORMS_FROM_ADDRESS && dflt.sent[0]?.site === 'saoc', "RED a missing site defaults to the SAOC sender and site 'saoc'");
const nul = capture();
await send({ contactName: 'Visitor', email: 'visitor@example.com', site: null }, nul.mailer);
expect(nul.sent[0]?.from === FORMS_FROM_ADDRESS && nul.sent[0]?.site === 'saoc', "RED a null site (stored source null) uses the SAOC sender and site 'saoc'");

// RED the route threads the stored site into the acknowledgement; the client cannot choose it.
const route = readFileSync('app/api/sponsors/enquire/route.ts', 'utf8').replace(/\s+/g, ' ');
expect(/sendSponsorEnquiryConfirmationEmail\(\{[^}]*\bsite:\s*doc\.source/.test(route), 'RED route passes site: doc.source to the acknowledgement');

if (failures.length) { console.error(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('PASS: acknowledgement sender, site, subject and preview follow the submission host');
