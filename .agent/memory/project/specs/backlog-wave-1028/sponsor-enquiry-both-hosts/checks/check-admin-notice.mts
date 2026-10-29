// sponsor-enquiry-both-hosts F2 (items 2+3): the real admin-notice sender with a fake mailer. No email is sent.
// PIN lines pass on main; RED lines fail on main (the subject is hard-coded "SAOC" for both hosts).
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import { sendSponsorEnquiryAdminNotice } from '@/lib/sponsor-enquiry-admin-notice.ts';
import type { SponsorEnquiryDoc, SponsorEnquirySite } from '@/lib/sponsor-enquiry.ts';

const failures: string[] = [];
const expect = (ok: boolean, label: string) => { if (!ok) failures.push(label); };

const doc = (source: SponsorEnquirySite): SponsorEnquiryDoc => ({
  contactName: 'E2E Tester', organisation: null, email: 'visitor@example.com', phone: null, website: null,
  level: null, message: 'We would like to sponsor.', consent: true, source, status: 'new', submittedAt: new Date('2026-10-28T10:00:00Z'),
});
type Sent = { to: string; subject: string; react: unknown; from?: string };
const capture = () => { const sent: Sent[] = []; return { sent, mailer: { send: async (a: Sent) => { sent.push(a); } } }; };

process.env.ADMIN_EMAIL_ALLOWLIST = 'one@admin.test, Two@admin.test';
const saoc = capture();
await sendSponsorEnquiryAdminNotice({ enquiryId: 'e1', doc: doc('saoc') }, { mailer: saoc.mailer });
const nos = capture();
await sendSponsorEnquiryAdminNotice({ enquiryId: 'e2', doc: doc('nos') }, { mailer: nos.mailer });

// PIN recipients: exactly the allowlist, one mail each, never the submitter.
expect(saoc.sent.map((m) => m.to).sort().join() === 'one@admin.test,two@admin.test', 'PIN recipients are exactly the ADMIN_EMAIL_ALLOWLIST entries');
expect(!saoc.sent.some((m) => m.to === 'visitor@example.com') && !nos.sent.some((m) => m.to === 'visitor@example.com'), 'PIN the submitter is never an admin-notice recipient');
// RED the two sites are distinguishable from the subject line alone.
const subjSaoc = saoc.sent[0]?.subject ?? '';
const subjNos = nos.sent[0]?.subject ?? '';
expect(subjSaoc !== subjNos, 'RED saoc and nos admin-notice subjects differ');
expect(/National Orchid Show/.test(subjNos) && !/\bSAOC\b/.test(subjNos), 'RED nos subject names the National Orchid Show and not SAOC');
expect(/\bSAOC\b/.test(subjSaoc) && !/National Orchid Show/.test(subjSaoc), 'PIN saoc subject names SAOC only');
// PIN body carries the site label (the existing "Site:" row).
const reactProps = (m?: Sent) => (m?.react as { props?: { siteLabel?: string } } | undefined)?.props;
expect(reactProps(nos.sent[0])?.siteLabel === 'National Orchid Show' && reactProps(saoc.sent[0])?.siteLabel === 'SAOC', 'PIN notice body siteLabel is the per-site label');
// RED an unknown source (null) must not crash and must not claim a site.
const unk = capture();
let threw = false;
try { await sendSponsorEnquiryAdminNotice({ enquiryId: 'e3', doc: { ...doc('saoc'), source: null as unknown as SponsorEnquirySite } }, { mailer: unk.mailer }); } catch { threw = true; }
expect(!threw && unk.sent.length === 2, 'PIN a null source still sends the notice (no crash)');
// PIN empty allowlist: no send, no throw.
process.env.ADMIN_EMAIL_ALLOWLIST = '';
const none = capture();
let threwNone = false;
try { await sendSponsorEnquiryAdminNotice({ enquiryId: 'e4', doc: doc('saoc') }, { mailer: none.mailer }); } catch { threwNone = true; }
expect(!threwNone && none.sent.length === 0, 'PIN empty allowlist sends nothing and does not throw');

if (failures.length) { console.error(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('PASS: admin notice recipients, per-site subject, per-site label');
