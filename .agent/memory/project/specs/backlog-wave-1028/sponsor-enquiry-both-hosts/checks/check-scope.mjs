// sponsor-enquiry-both-hosts F2 (items 1+4+5): the change reuses the form and API (no fork), adds no visitor email, and
// invents no copy. Guards pass on main by design and fail the moment a fix drifts. Run from the checkout under test.
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const failures = [];

// Item 1 + 4: these files must not change. The form and API are reused as-is; the visitor acknowledgement is untouched.
for (const file of ['components/sponsors/SponsorEnquiryForm.tsx', 'app/api/sponsors/enquire/route.ts', 'lib/sponsor-enquiry-confirmation.ts', 'emails/SponsorEnquiryConfirmation.tsx']) {
  if (git('diff', 'origin/main', '--name-only', '--', file).trim() !== '') failures.push(`${file} differs from origin/main (reuse the form/API, add no visitor email)`);
}
// Item 4: exactly the two existing senders in the route, no third.
const route = git('show', 'HEAD:app/api/sponsors/enquire/route.ts');
if ((route.match(/deliverConfirmationEmailAfterCommit\(/g) ?? []).length !== 2) failures.push('route.ts must keep exactly two notification sends (admin notice + acknowledgement)');
// Item 1: not a fork — no new enquiry component/handler file anywhere.
const added = git('diff', 'origin/main', '--name-only', '--diff-filter=A').split('\n').filter(Boolean);
const forked = added.filter((f) => /enquir/i.test(f) && !f.startsWith('.agent/') && !f.startsWith('contracts/checks/'));
if (forked.length) failures.push(`new enquiry-named product files (a fork?): ${forked.join(', ')}`);
// Item 5: no new exported copy string without a source.
const copyDiff = git('diff', 'origin/main', '-U0', '--', 'lib/sponsor-enquiry-copy.ts');
const newExports = copyDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++') && /export const/.test(l));
if (newExports.length) failures.push(`lib/sponsor-enquiry-copy.ts adds new copy exports (list as gaps instead): ${newExports.join(' | ')}`);

if (failures.length) { console.error(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('PASS: form/API/confirmation untouched, two sends, no fork, no new copy export');
