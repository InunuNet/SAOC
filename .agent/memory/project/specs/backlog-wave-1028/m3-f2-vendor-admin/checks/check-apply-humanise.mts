// F2a: server-side /apply validation errors become labels, never raw keys. Pure, no I/O.
import { humaniseVendorApplyError, VENDOR_APPLY_FIELD_ORDER } from '../../../../../../../lib/vendor-apply-form-validation.ts';

const failures: string[] = [];
const GENERIC = 'Please check the highlighted fields.';

for (const key of VENDOR_APPLY_FIELD_ORDER) {
  for (const tail of ['is required and must be a non-empty string', 'is required and must be a non-empty array', 'is required and must be a positive integer']) {
    const out = humaniseVendorApplyError(`${key} ${tail}`);
    if (out.includes(key) && key !== 'tradingName') failures.push(`${key}: label output leaks the key: ${out}`);
    if (/[a-z][A-Z]/.test(out)) failures.push(`${key}: camelCase in output: ${out}`);
    if (out.includes('must be a')) failures.push(`${key}: raw wording in output: ${out}`);
    if (out === GENERIC) failures.push(`${key}: known key fell through to generic`);
  }
}
if (humaniseVendorApplyError('businessName is required and must be a non-empty string') !== 'Business name is required.') {
  failures.push('businessName must read exactly "Business name is required."');
}
if (humaniseVendorApplyError('somethingUnknown is weird') !== GENERIC) failures.push('unknown key must return the generic sentence');
if (humaniseVendorApplyError('') !== GENERIC) failures.push('empty input must return the generic sentence');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('PASS');
