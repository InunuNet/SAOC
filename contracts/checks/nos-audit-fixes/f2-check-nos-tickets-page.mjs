// F2 / A3 — /national-show/tickets sends every public admission product to /tickets/<slug>.
// Decision (contract-f2 D2): the admission card renders one link per publicly listable
// admission product (same filter /tickets uses), href `/tickets/${p.slug}`, label the Sanity
// `name`. Wrong fixes this rejects: a hard-coded slug, a single dominant-only link, sending
// Conferences/Workshops cards to /tickets/<slug> (that route 404s non-admission products), and
// pulling in the Firebase sold-count call (breaks the build-without-secrets contract).
// D4: with no public admission product the card must still link somewhere, so base's
// "Get visitor tickets" -> /tickets button renders verbatim, gated on the list being empty.
import { emptyListFallbackSpan, fail, pass, readRepoFile, stripComments } from './f2-_lib.mjs';

const ID = 'f2-nos-tickets-page';
const FILE = 'app/(marketing)/national-show/tickets/page.tsx';

const raw = readRepoFile(FILE);
if (raw === null) fail(ID, [`${FILE} is missing`]);
const src = stripComments(raw);
const problems = [];

if (!/import\s*\{[^}]*\bfilterPubliclyListableTicketTypes\b[^}]*\}\s*from\s*['"]@\/lib\/demo-ticket-type['"]/.test(src)) {
  problems.push("filterPubliclyListableTicketTypes is not imported from '@/lib/demo-ticket-type'");
}
if (!/\bfilterPubliclyListableTicketTypes\s*\(/.test(src)) {
  problems.push('filterPubliclyListableTicketTypes(...) is never called');
}

// One link per product: a .map((p) => ...) whose body builds href={`/tickets/${p.slug}`} and
// labels it with p.name before the link closes.
const maps = [...src.matchAll(/\.map\(\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>/g)];
const perProduct = maps.some((m) => {
  const p = m[1];
  const body = src.slice(m.index);
  const href = body.search(new RegExp(`href=\\{\\s*\`/tickets/\\$\\{\\s*${p}\\.slug\\s*\\}\`\\s*\\}`));
  if (href === -1) return false;
  const close = body.slice(href).search(/<\/(Button|Link)>/);
  return close !== -1 && new RegExp(`\\{\\s*${p}\\.name\\s*\\}`).test(body.slice(href, href + close));
});
if (!perProduct) {
  problems.push('no .map((p) => ...) renders href={`/tickets/${p.slug}`} labelled {p.name}');
}

if (!emptyListFallbackSpan(src)) {
  problems.push('no empty-list fallback: base "Get visitor tickets" -> /tickets button, gated on the filtered list being empty (D4)');
}

const literalSlug = src.match(/href\s*[=:]\s*\{?\s*["'`]\/tickets\/[A-Za-z0-9-]+["'`]/);
if (literalSlug) problems.push(`hard-coded product slug: ${literalSlug[0]} (slugs come from Sanity)`);

for (const href of ['/national-show/exhibitors', '/national-show/vendors/apply', '/national-show/conferences', '/national-show/workshops']) {
  if (!src.includes(`href: '${href}'`)) problems.push(`secondary option href '${href}' changed or removed`);
}

if (!/export const revalidate = 60;/.test(src)) problems.push('export const revalidate = 60 is gone');
if (/force-dynamic|getSoldCountsByTicketType|firebase-admin/.test(src)) {
  problems.push('page now reaches live inventory / force-dynamic (contract-build-without-secrets)');
}

if (problems.length) fail(ID, problems);
pass(ID);
