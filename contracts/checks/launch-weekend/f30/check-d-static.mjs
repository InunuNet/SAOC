// F30-A4 - static wiring the offline behavioural checks cannot see: admin gate, no Sanity mutation other than
// createIfNotExists, secrets, the single eligibility predicate, schema/query/type wiring, unchanged public page.
// Run from the repo root: node contracts/checks/launch-weekend/f30/check-d-static.mjs
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const problems = [];
const must = (name, cond) => { if (!cond) problems.push(name); };
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const LIB = 'lib/vendor-listing.ts';
const ADAPTER = 'lib/vendor-listing-sanity.ts';
const ROUTE = 'app/api/admin/vendors/[id]/publish-listing/route.ts';
for (const f of [LIB, ADAPTER, ROUTE]) must(`${f} exists`, existsSync(f));
const lib = strip(read(LIB));
const adapter = strip(read(ADAPTER));
const route = strip(read(ROUTE));

// Pure module
must('lib has no firebase/sanity/next imports', !/from\s+['"](firebase|firebase-admin|@sanity|next-sanity|sanity|next)[/'"]/.test(lib));
must('lib is not a client module', !/['"]use client['"]/.test(lib));
must('lib imports only types from @/types', !/import\s+(?!type)[^;]*from\s+['"]@\/types/.test(lib));

// Single named predicate: the approval literal lives only in lib/vendor-listing.ts
for (const f of [ADAPTER, ROUTE, 'components/admin/VendorReviewTable.tsx']) {
  const body = f === ADAPTER ? adapter : f === ROUTE ? route : null;
  if (body !== null) must(`${f} does not restate the eligibility basis`, !/status\s*[!=]==?\s*['"]approved['"]/.test(body));
}
must('lib defines isVendorListingEligible', /export\s+function\s+isVendorListingEligible/.test(lib));
must('route uses publishVendorListing', route.includes('publishVendorListing'));

// Admin gate, same shape as the review route
must('route is POST', /export\s+async\s+function\s+POST/.test(route));
must('route calls getAdminSession', route.includes('getAdminSession('));
must('route checks review-vendor-applications', route.includes("'review-vendor-applications'"));
must('route returns 401 and 403', route.includes('401') && route.includes('403'));
must('route auth precedes the Firestore read', route.indexOf('getAdminSession(') !== -1 && route.indexOf('getAdminSession(') < route.indexOf('getFirestore('));

// No mutation but createIfNotExists
for (const [f, body] of [[LIB, lib], [ADAPTER, adapter], [ROUTE, route]]) {
  must(`${f} has no createOrReplace/createOrUpdate/patch/delete/mutate/transaction`, !/\.(createOrReplace|createOrUpdate|patch|delete|mutate|transaction)\s*\(/.test(body));
}
must('lib uses createIfNotExists', lib.includes('createIfNotExists'));

// Secrets
must('adapter reads SANITY_API_TOKEN from env', adapter.includes('process.env.SANITY_API_TOKEN'));
must('no NEXT_PUBLIC token', !/NEXT_PUBLIC_[A-Z_]*TOKEN/.test(adapter + route + lib));
must('adapter is not a client module', !/['"]use client['"]/.test(adapter));

// Audit write: update (not set), coalesced
must('audit uses ref.update', /ref\.update\(/.test(route));
must('audit coalesces listingPublishedBy to null', /listingPublishedBy:[^,}]*\?\?\s*null/.test(route));
const types = read('types/index.ts');
for (const f of ['listingPublishedAt', 'listingPublishedBy', 'listingDocumentId']) must(`VendorSubmission declares ${f}`, types.includes(f));

// Sanity schema, query, grid
const schema = read('sanity/schemas/documents/vendorNursery.ts');
must("vendorNursery schema declares 'bio'", /name:\s*'bio'/.test(schema));
must('vendorNursery schema adds no contact fields', !/name:\s*'(email|phone|contact[A-Za-z]*|address)'/i.test(schema));
const queries = read('sanity/queries.ts');
const q = queries.slice(queries.indexOf('export const vendorNurseriesQuery'));
must('vendorNurseriesQuery projects bio', /\bbio\b/.test(q.slice(0, q.indexOf('`);') + 3)));
must('VendorGrid renders nursery.bio', read('components/vendors/VendorGrid.tsx').includes('nursery.bio'));

// Admin UI
const table = read('components/admin/VendorReviewTable.tsx');
must('admin table has the Publish to listing action', table.includes('Publish to listing') && table.includes('publish-listing'));

// Public page unchanged vs base; the outreach tracker never seeds anything
const base = process.env.BASE_REF || 'origin/main';
try {
  execFileSync('git', ['diff', '--quiet', base, '--', 'app/(marketing)/national-show/vendors/page.tsx']);
} catch { problems.push('public vendors page.tsx differs from base (must be reused unchanged)'); }
for (const f of [LIB, ADAPTER, ROUTE]) must(`${f} never references the xlsx tracker`, !/\.xlsx|Vendor Listing/i.test(read(f)));

if (problems.length > 0) { console.error(`FAIL F30-A4:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log('PASS F30-A4 static wiring');
