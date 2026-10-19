// F30-A1 - the single listing-eligibility predicate (basis: approved), driven by the golden table.
// Run from the repo root: pnpm exec tsx contracts/checks/launch-weekend/f30/check-a-eligibility.mts
import * as listing from '../../../../lib/vendor-listing.ts';
import { golden, makeChecker } from './_lib.mts';

type Case = { status: string; paymentReceived?: boolean; standOrderStatus?: string | null; expected: boolean };
const table = golden<{ basis: string; cases: Case[] }>('eligibility-table.json');
const { eq, ok, finish } = makeChecker('F30-A1 eligibility');
const fn = listing.isVendorListingEligible as ((i: unknown) => boolean) | undefined;
ok('isVendorListingEligible is exported', typeof fn === 'function');
eq('basis constant', (listing as Record<string, unknown>).LISTING_ELIGIBILITY_BASIS, table.basis);
if (typeof fn === 'function') {
  for (const c of table.cases) {
    const { expected, ...input } = c;
    eq(`eligible(${JSON.stringify(input)})`, fn(input), expected);
  }
}
finish();
