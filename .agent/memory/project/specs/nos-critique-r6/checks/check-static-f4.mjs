// nos-critique-r6 F4 — static source check for the SEO item (lead saoc-2b 2026-10-17): FAQPage + BreadcrumbList JSON-LD.
//   S1  components/seo/JsonLd.tsx exports faqPageJsonLd and portableTextToPlainText (FAQPage / Question / Answer shapes).
//   S2  faq/page.tsx renders it from the same `faqs` array as ShowFaqList, restricted to status === 'confirmed' with a
//       non-empty answer; no second Sanity fetch.
//   S3  components/nos/NosBreadcrumbJsonLd.tsx: 'use client', usePathname, breadcrumbJsonLd; mounted once by
//       national-show/layout.tsx with a labels map built from nav-config (NAV); no hub page edit for f4.
//   S4  no `validFrom` in any file f4 adds or edits (no source field exists), Event offers code untouched
//       (buildAdmissionOffers still defined in the hub page.tsx only).
//   S5  docs cite the SEO item, FAQPage, BreadcrumbList, and say validFrom was not added.
// Run as: node check-static-f4.mjs   (NOS_CR6_ROOT selects the worktree)
import { DOC, NS, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static-f4.mjs';
const failures = [];
const fail = (m) => failures.push(m);

const jl = stripComments(readRepoFile('components/seo/JsonLd.tsx') ?? '');
if (!/export function faqPageJsonLd\(/.test(jl)) fail('JsonLd.tsx must export faqPageJsonLd (S1)');
if (!/export function portableTextToPlainText\(/.test(jl)) fail('JsonLd.tsx must export portableTextToPlainText (S1)');
for (const t of ["'FAQPage'", "'Question'", "'Answer'", 'acceptedAnswer', 'mainEntity']) if (!jl.includes(t)) fail(`JsonLd.tsx lacks ${t} (S1)`);

const faq = stripComments(readRepoFile(`${NS}/faq/page.tsx`) ?? '');
if (!/faqPageJsonLd/.test(faq) || !/<JsonLd\b/.test(faq)) fail('faq/page.tsx must render <JsonLd data={faqPageJsonLd(...)} /> (S2)');
if (!/status\s*===\s*'confirmed'/.test(faq) || !/hideUnanswered/.test(faq)) fail("faq/page.tsx must include answered entries the page presents as settled: hasFaqAnswer && (hideUnanswered || status === 'confirmed') (S2)");
if ((faq.match(/hasFaqAnswer/g) ?? []).length < 3) fail('faq/page.tsx must filter the JSON-LD entries with the existing hasFaqAnswer helper (a third use beyond the import and `holds`), not retype the rule (S2)');
if ((faq.match(/sanityFetch</g) ?? []).length !== 2) fail('faq/page.tsx must reuse its two existing fetches, adding none (S2)');
const listProp = (faq.match(/<ShowFaqList[\s\S]{0,200}?\bfaqs=\{(\w+)\}/) ?? [])[1];
if (!listProp || listProp === 'faqs') fail('faq/page.tsx must compute ONE derived list and give it to <ShowFaqList faqs={...}> (not the raw `faqs`), so the page has a single filter (S2, lead 2026-10-17)');
else {
  const entries = (faq.match(/const faqEntries[\s\S]{0,600}?;\n/) ?? [''])[0];
  if (!new RegExp(`\\b${listProp}\\b`).test(entries)) fail(`the JSON-LD entries must be derived from ${listProp}, the exact list ShowFaqList renders, not from their own filter (S2)`);
  if ((faq.match(/faqCategoryRank/g) ?? []).length > 2) fail('faq/page.tsx sorts and filters the FAQ list twice; derive the JSON-LD from the list the page renders (S2)');
}

const bc = stripComments(readRepoFile('components/nos/NosBreadcrumbJsonLd.tsx') ?? '');
if (bc === '') fail('components/nos/NosBreadcrumbJsonLd.tsx is missing (S3)');
else {
  const raw = readRepoFile('components/nos/NosBreadcrumbJsonLd.tsx');
  if (!/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*'use client';/.test(raw)) fail("NosBreadcrumbJsonLd.tsx must be a 'use client' component (S3)");
  if (!/usePathname/.test(bc)) fail('NosBreadcrumbJsonLd.tsx must read usePathname() (S3)');
  if (!/breadcrumbJsonLd\(/.test(bc)) fail('NosBreadcrumbJsonLd.tsx must build the node with breadcrumbJsonLd() (S3)');
  if (!/https:\/\/saoc\.co\.za/.test(bc)) fail('NosBreadcrumbJsonLd.tsx must use the https://saoc.co.za origin the hub Event node uses (S3)');
}
const layout = stripComments(readRepoFile(`${NS}/layout.tsx`) ?? '');
if ((layout.match(/<NosBreadcrumbJsonLd\b/g) ?? []).length !== 1) fail('national-show/layout.tsx must mount <NosBreadcrumbJsonLd> exactly once (S3)');
if (!/nav-config/.test(layout) || !/\bNAV\b/.test(layout)) fail('national-show/layout.tsx must build the labels map from nav-config NAV (S3)');

for (const rel of ['components/nos/NosBreadcrumbJsonLd.tsx', `${NS}/layout.tsx`, `${NS}/faq/page.tsx`]) {
  if (/validFrom/.test(stripComments(readRepoFile(rel) ?? ''))) fail(`${rel}: validFrom has no source field and must not appear (S4)`);
}
const hubNow = readRepoFile(`${NS}/page.tsx`) ?? '';
if (!/function buildAdmissionOffers\(/.test(hubNow)) fail('hub page.tsx must still define buildAdmissionOffers (S4)');
if (!/__html:[^}]{0,120}\.replace\(\s*\/<\/g\s*,\s*['"]\\\\u003c['"]\s*\)/.test(jl)) fail("JsonLd.tsx must escape `<` as the literal text \\u003c (JSON.stringify(data).replace(/</g, '\\\\u003c')) before dangerouslySetInnerHTML, so a </script> in Sanity text cannot break out of the tag (S1, Codex P1)");
const jlBase = stripComments(readBaseFile('components/seo/JsonLd.tsx') ?? '');
const slice = (s) => (s.match(/export function nationalShowEventJsonLd[\s\S]*?\n\}\n/) ?? [''])[0];
if (slice(jl) !== slice(jlBase)) fail('nationalShowEventJsonLd in JsonLd.tsx must be unchanged (S4)');

const doc = readRepoFile(DOC) ?? '';
if (!/SEO/.test(doc) || !/FAQPage/.test(doc) || !/BreadcrumbList/.test(doc) || !/validFrom/.test(doc)) fail(`${DOC} must cite the SEO item, FAQPage, BreadcrumbList and explain why validFrom was not added (S5)`);

finish(NAME, failures, 'SEO: faqPageJsonLd on the FAQ page from the same confirmed entries, one NosBreadcrumbJsonLd mounted by the layout, Event builder untouched, no validFrom, docs present.');
