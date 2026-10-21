// nos-critique-r12 shared guard for app/(marketing)/tickets/[slug]/page.tsx, which F2, F3 and F4 each edit (QA input, hash-locked).
// Outside generateMetadata, the import statements, one `headingLevel="h2"` line and F4's NOS_TITLE_SUFFIX constant, the file must equal BASE;
// the only import it may add is F4's buildPageMetadata. Each feature's static check then asserts its own edit.
export const TICKET_PAGE = 'app/(marketing)/tickets/[slug]/page.tsx';
export const SEO_IMPORT = "import { buildPageMetadata } from '@/lib/seo';";

const GENERATE_METADATA = /export async function generateMetadata\([\s\S]*?\n}\n/;
const IMPORTS = /^import [\s\S]*?;\n/gm;

export const generateMetadataOf = (src) => src.match(GENERATE_METADATA)?.[0] ?? '';
const importsOf = (src) => (src.match(IMPORTS) ?? []).map((s) => s.replace(/\s+/g, ' ').trim());
// F4 may add one module constant for the NOS title template (tickets/* sit outside national-show/layout.tsx).
export const NOS_SUFFIX_CONST = "const NOS_TITLE_SUFFIX = ' — National Orchid Show | SAOC';";
const rest = (src) => src.replace(GENERATE_METADATA, '').replace(IMPORTS, '').replace(/^[ \t]*headingLevel="h2"\n/m, '').replace(`${NOS_SUFFIX_CONST}\n\n`, '').replace(`${NOS_SUFFIX_CONST}\n`, '');

export function ticketPageFailures(head, base, tag) {
  const out = [];
  if (head === null || base === null) return [`${TICKET_PAGE} is missing at HEAD or BASE (${tag})`];
  if (!generateMetadataOf(head)) out.push(`${TICKET_PAGE}: no \`export async function generateMetadata(...)\` (${tag})`);
  if (rest(head) !== rest(base)) out.push(`${TICKET_PAGE}: outside generateMetadata, the imports and one headingLevel="h2" line the file must equal BASE (${tag})`);
  const hi = importsOf(head);
  const bi = importsOf(base);
  for (const i of bi) if (!hi.includes(i)) out.push(`${TICKET_PAGE}: BASE import removed or changed: ${i} (${tag})`);
  for (const i of hi) if (!bi.includes(i) && i !== SEO_IMPORT) out.push(`${TICKET_PAGE}: unexpected import ${i} (${tag})`);
  return out;
}
