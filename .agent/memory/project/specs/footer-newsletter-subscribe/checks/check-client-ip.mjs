// footer-newsletter-subscribe -- client IP from X-Forwarded-For. Run: npx tsx <this file>
import { clientIpFromForwardedFor } from '../../../../../../lib/client-ip.ts';

const failures = [];
const check = (name, got, want) => { if (got !== want) failures.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

check('1 entry', clientIpFromForwardedFor('203.0.113.7'), '203.0.113.7');
check('2 entries => first of two (second-to-last)', clientIpFromForwardedFor('203.0.113.7, 130.211.0.1'), '203.0.113.7');
check('3 entries => middle, never first (spoofable)', clientIpFromForwardedFor('6.6.6.6, 203.0.113.7, 130.211.0.1'), '203.0.113.7');
check('4 entries => second-to-last', clientIpFromForwardedFor('6.6.6.6, 7.7.7.7, 203.0.113.7, 130.211.0.1'), '203.0.113.7');
check('whitespace trimmed', clientIpFromForwardedFor('  6.6.6.6 ,203.0.113.7 ,  130.211.0.1  '), '203.0.113.7');
check('empty entries dropped', clientIpFromForwardedFor(',203.0.113.7,, 130.211.0.1,'), '203.0.113.7');
check('never the last of 3', clientIpFromForwardedFor('a, b, c') === 'c', false);
check('empty string => null', clientIpFromForwardedFor(''), null);
check('only commas => null', clientIpFromForwardedFor(' , ,'), null);
check('null => null', clientIpFromForwardedFor(null), null);
check('undefined => null', clientIpFromForwardedFor(undefined), null);

if (failures.length) { console.error('FAIL', failures); process.exit(1); }
console.log('client-ip checks pass');
