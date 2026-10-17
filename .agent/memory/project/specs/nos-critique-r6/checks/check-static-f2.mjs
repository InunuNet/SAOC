// nos-critique-r6 F2 — static source check for R63 (NOS-scoped not-found for /national-show/*; lead saoc-2b 2026-10-17).
//   S1  national-show/[...slug]/page.tsx exists, imports notFound from next/navigation and calls it; no fetch/sanity import.
//   S2  national-show/not-found.tsx exists: eyebrow, h1, sentence one verbatim from app/not-found.tsx, no SAOC sentence two,
//       exactly one h1, three recovery links with the nav-config labels and hrefs in the hero's R67 order Tickets (primary),
//       National Show, Plan your visit (the other two ghost) — Codi's final order.
//   S3  app/not-found.tsx is byte-identical to BASE; no hex colour and no new CSS file.
//   S4  docs/nos-critique-r6.md cites R63.
// Run as: node check-static-f2.mjs   (NOS_CR6_ROOT selects the worktree)
import { DOC, NS, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static-f2.mjs';
const failures = [];
const fail = (m) => failures.push(m);
const squash = (s) => s.replace(/&rsquo;/g, '’').replace(/\s+/g, ' ');

const slug = readRepoFile(`${NS}/[...slug]/page.tsx`);
if (slug === null) fail(`${NS}/[...slug]/page.tsx is missing (S1)`);
else {
  const code = stripComments(slug);
  if (!/import\s*\{[^}]*\bnotFound\b[^}]*\}\s*from\s*'next\/navigation'/.test(code)) fail('[...slug]/page.tsx must import notFound from next/navigation (S1)');
  if (!/\bnotFound\(\)/.test(code)) fail('[...slug]/page.tsx must call notFound() (S1)');
  if (/sanity|firebase|fetch\(/i.test(code)) fail('[...slug]/page.tsx must not fetch data (S1)');
}

if (readRepoFile(`${NS}/archive/[year]/page.tsx`) === null) fail('archive/[year]/page.tsx must exist beside the [...slug] catch-all, so Next resolves the specific segment first (S1)');
const nf = readRepoFile(`${NS}/not-found.tsx`);
if (nf === null) fail(`${NS}/not-found.tsx is missing (S2)`);
else {
  const code = stripComments(nf);
  const text = squash(code);
  if (!/export default function \w+/.test(code)) fail('not-found.tsx must default-export a component (S2)');
  for (const must of ['404 — Page not found', 'This orchid has left the bench.', 'The page you’re looking for doesn’t exist or may have moved.']) {
    if (!text.includes(must)) fail(`not-found.tsx must carry the SAOC root copy verbatim: "${must}" (S2)`);
  }
  if (/find a society|Start from the home page/i.test(text)) fail('not-found.tsx must not reuse the SAOC root sentence two or its Society links (S2)');
  if ((code.match(/<h1\b/g) ?? []).length !== 1) fail('not-found.tsx must render exactly one <h1> (S2)');
  const links = [['Tickets', '/national-show/tickets', 'primary'], ['National Show', '/national-show', 'ghost'], ['Plan your visit', '/national-show/plan-your-visit', 'ghost']];
  let last = -1;
  for (const [label, href, variant] of links) {
    const tag = (code.match(new RegExp(`<[A-Za-z.]+[^>]*href=["']${href}["'][^>]*>`)) ?? [''])[0];
    if (!new RegExp(`variant=["']${variant}["']`).test(tag)) fail(`the ${label} link must be a nos Button variant="${variant}" (S2)`);
    const hrefAt = code.indexOf(`href="${href}"`) >= 0 ? code.indexOf(`href="${href}"`) : code.indexOf(`href='${href}'`);
    if (hrefAt < 0) fail(`not-found.tsx lacks a link to ${href} (S2)`);
    if (!new RegExp(`>\\s*${label}\\s*<`).test(code)) fail(`not-found.tsx lacks the label "${label}" (S2)`);
    if (hrefAt >= 0 && hrefAt < last) fail(`not-found.tsx links must be in order Tickets, National Show, Plan your visit (S2)`);
    last = Math.max(last, hrefAt);
  }
  if (/#[0-9a-fA-F]{3,8}\b/.test(code)) fail('not-found.tsx must use theme tokens, not hex colours (S3)');
}
if (readRepoFile('app/not-found.tsx') !== readBaseFile('app/not-found.tsx')) fail('app/not-found.tsx (SAOC root) must be unchanged (S3)');

const doc = readRepoFile(DOC);
if (doc === null || !/R63/.test(doc)) fail(`${DOC} must cite R63 (S4)`);

finish(NAME, failures, 'R63: catch-all calls notFound(), NOS not-found carries the SAOC copy verbatim and the three nav-config links, root not-found untouched, docs cite R63.');
