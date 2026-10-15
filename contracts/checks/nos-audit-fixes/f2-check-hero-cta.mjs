// F2 / A2 — the /national-show hero "Book tickets →" goes to /national-show/tickets.
// Decision (contract-f2 D1): the hero cannot name one admission product (Sanity has five), so
// it goes to the NOS ticket page, whose buy actions are /tickets/<slug>. The label is pinned
// verbatim so a fix cannot "repoint" by renaming or deleting the button.
import { NOS_TICKETS_PATH, fail, pass, readRepoFile, stripComments } from './f2-_lib.mjs';

const ID = 'f2-hero-cta';
const FILE = 'app/(marketing)/national-show/page.tsx';
const LABEL = '<span data-nos-hero-text="btn-primary-label">Book tickets →</span>';

const raw = readRepoFile(FILE);
if (raw === null) fail(ID, [`${FILE} is missing`]);
const src = stripComments(raw);

const problems = [];
const at = src.indexOf(LABEL);
if (at === -1) problems.push(`hero label not found verbatim: ${LABEL}`);
else if (src.indexOf(LABEL, at + 1) !== -1) problems.push('hero label appears more than once');
else {
  const open = src.lastIndexOf('<Button', at);
  const tag = open === -1 ? '' : src.slice(open, at);
  const href = tag.match(/\shref=(\{?\s*["'`][^"'`]*["'`]\s*\}?|\{[^}]*\})/);
  if (!href) problems.push('the hero primary <Button> has no href');
  else {
    const value = href[1].trim().replace(/^\{\s*|\s*\}$/g, '').replace(/^["'`]|["'`]$/g, '');
    if (value !== NOS_TICKETS_PATH) problems.push(`hero primary href is ${href[1].trim()}, expected "${NOS_TICKETS_PATH}"`);
  }
  if (!/\sas=\{Link\}/.test(tag)) problems.push('hero primary <Button> is no longer rendered as={Link}');
}
if (problems.length) fail(ID, problems);
pass(ID);
