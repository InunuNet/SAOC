// sponsor-enquiry-both-hosts scope guard (items 1, 4, 5, amended 2026-10-28 for the NOS Design rulings and D2).
// Passes on main by design; it fails the moment a fix drifts. Run from the checkout under test; reads the COMMITTED HEAD.
//  - the shared form may change ONLY inside its success-state block, and its SAOC behaviour there is pinned
//  - the API route may change ONLY on the acknowledgement call (threading the site, D2); it keeps exactly two sends
//  - the acknowledgement path may change (D2) but stays ONE send to the submitted address, no new visitor email
//  - no forked enquiry file, no new exported copy string
import { execFileSync } from 'node:child_process';

// merge-base, not the moving origin/main tip: unrelated merges to main must not read as this change's drift.
const BASE = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { encoding: 'utf8' }).trim();
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const failures = [];

const FORM = 'components/sponsors/SponsorEnquiryForm.tsx';
const successBlock = (src) => {
  const start = src.indexOf("if (status === 'success') {");
  const end = src.indexOf('\n  }\n', start);
  return start === -1 || end === -1 ? null : { start, end: end + 5 };
};
const before = git('show', `${BASE}:${FORM}`);
const after = git('show', `HEAD:${FORM}`);
const b = successBlock(before);
const a = successBlock(after);
if (!b || !a) failures.push(`${FORM}: success-state block not found`);
else {
  if (before.slice(0, b.start) + before.slice(b.end) !== after.slice(0, a.start) + after.slice(a.end)) {
    failures.push(`${FORM} changed outside the success-state block (the form is reused as-is; only the success state may change)`);
  }
  const block = after.slice(a.start, a.end);
  // SAOC behaviour pinned: the SAOC success still shows the heading AND the SAOC body, in a role=status region whose heading takes focus.
  if (!/site === 'saoc'[\s\S]*ENQUIRY_REUSED\.successBody/.test(block)) failures.push(`${FORM}: the SAOC success body (site === 'saoc' -> successBody) must stay`);
  if (!block.includes('ENQUIRY_REUSED.successHeading')) failures.push(`${FORM}: success heading must stay`);
  if (!/role="status"/.test(block) || !/tabIndex=\{-1\}/.test(block) || !/ref=\{successHeading\}/.test(block)) failures.push(`${FORM}: success state must keep role="status" and a tabIndex -1 heading that takes focus`);
  if (/site === 'nos'[\s\S]*successBody|successBody[\s\S]*site !== 'saoc'/.test(block)) failures.push(`${FORM}: NOS success must stay heading-only (NOS Design ruling); no body for nos`);
}

// Route: changed lines may only concern the acknowledgement call and its site argument.
const routeDiff = git('diff', BASE, 'HEAD', '-U0', '--', 'app/api/sponsors/enquire/route.ts')
  .split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
const routeStray = routeDiff.filter((l) => !/site|contactName|email|Confirmation|^[+-]\s*[})\]]*[,;]?\s*$/.test(l));
if (routeStray.length) failures.push(`route.ts changed beyond the acknowledgement call: ${routeStray.join(' | ')}`);
const route = git('show', 'HEAD:app/api/sponsors/enquire/route.ts');
if ((route.match(/deliverConfirmationEmailAfterCommit\(/g) ?? []).length !== 2) failures.push('route.ts must keep exactly two notification sends (admin notice + acknowledgement)');

// Acknowledgement: still one send, to the submitted address.
const conf = git('show', 'HEAD:lib/sponsor-enquiry-confirmation.ts');
if ((conf.match(/mailer\.send\(/g) ?? []).length !== 1 || !/to:\s*input\.email/.test(conf)) failures.push('lib/sponsor-enquiry-confirmation.ts must send exactly one mail, to input.email');

// Not a fork; no new copy.
const added = git('diff', BASE, 'HEAD', '--name-only', '--diff-filter=A').split('\n').filter(Boolean);
const forked = added.filter((f) => /enquir/i.test(f) && !f.startsWith('.agent/') && !f.startsWith('contracts/checks/'));
if (forked.length) failures.push(`new enquiry-named product files (a fork?): ${forked.join(', ')}`);
const copyDiff = git('diff', BASE, 'HEAD', '-U0', '--', 'lib/sponsor-enquiry-copy.ts');
const newExports = copyDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++') && /export const/.test(l));
if (newExports.length) failures.push(`lib/sponsor-enquiry-copy.ts adds new copy exports (list as gaps instead): ${newExports.join(' | ')}`);

if (failures.length) { console.error(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('PASS: form changes confined to the success state with SAOC behaviour pinned, route changes confined to the acknowledgement, one send, no fork, no new copy');
