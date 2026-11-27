// Terms-acceptance fields for a checkout POST made by a plain-node (no tsx) contract check.
// The checkout route refuses any request without them (lib/checkout-terms.ts). The versions are
// read from the two master files, the same constants lib/checkout-terms.ts derives
// CURRENT_TERMS_VERSIONS from, so a check never hard-codes a date that the next master edit stales.
import { readFileSync } from 'node:fs';

function readConstant(relativePath, name) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const match = source.match(new RegExp(`export const ${name} = '([^']+)'`));
  if (!match) throw new Error(`${name} not found in ${relativePath}`);
  return match[1];
}

export const CHECKOUT_TERMS_FIELDS = Object.freeze({
  termsAccepted: true,
  termsVersion: readConstant('../../../content/legal/terms.ts', 'TERMS_LAST_UPDATED'),
  refundPolicyVersion: readConstant('../../../content/legal/refunds.ts', 'REFUND_POLICY_LAST_UPDATED'),
});
