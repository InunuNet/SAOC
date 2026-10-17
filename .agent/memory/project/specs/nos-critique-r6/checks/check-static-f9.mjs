// nos-critique-r6 F9 - static source check for Brad chrome decisions #2 and #6 (2026-10-15), via NOS Design 2026-10-17.
//   S1  UtilityBar.tsx: the nos variant returns null (no wrapper, no reserved height); the SAOC path is untouched (root className, mailto, /national-show and /societies hrefs kept).
//   S2  nav-config.ts: exactly the four lines change - leadLabel "19th National Orchid Show", the Symposium descriptor, and the Day Visitor / Weekend Pass rail hrefs
//       (/national-show/tickets#ticket-day, #ticket-weekend); none of the old strings remains; nothing else in the file changes.
//   S3  nos-chrome.css keeps the approved header: 13px bar padding, 24px gap, sticky from 700px, the 699px relative header (16px 12px padding, 12px gap, scroll-padding-top 0);
//       no --lk- variables; NosHeader.tsx keeps LOCKUP_SRC and has no search.
//   S4  the NOS footer and header rules keep 44px minimum heights (.nf-list a, .nf-legal a, .nf-wild a, .nh-burger, .nh-cta).
//   S5  docs cite "Brad chrome decision #2 and #6 (2026-10-15), via NOS Design 2026-10-17" and quote the HANDOFF decisions verbatim.
// Run as: node check-static-f9.mjs   (NOS_CR6_ROOT selects the worktree)
import { DOC, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static-f9.mjs';
const failures = [];
const fail = (m) => failures.push(m);
const CSS = 'components/nos-chrome/nos-chrome.css';
const HEADER = 'components/nos-chrome/NosHeader.tsx';
const UTIL = 'components/chrome/UtilityBar.tsx';
const NAVCFG = 'components/chrome/nav-config.ts';

const util = stripComments(readRepoFile(UTIL) ?? '');
if (!/if \(isNos\)\s*\{?\s*return null/.test(util) && !/variant === 'nos'\)\s*\{?\s*return null/.test(util)) fail('UtilityBar: the nos variant must return null before rendering anything (S1)');
if (!/bg-primary-800 text-ivory/.test(util)) fail('UtilityBar: the SAOC root className "bg-primary-800 text-ivory" must remain (S1)');
for (const needle of ['href={`mailto:${CONTACT_EMAIL}`}', 'href="/national-show"', 'href="/societies"']) if (!util.includes(needle)) fail(`UtilityBar: SAOC markup ${needle} must remain (S1)`);

const nav = readRepoFile(NAVCFG) ?? '';
const baseNav = readBaseFile(NAVCFG) ?? '';
const want = ["leadLabel: '19th National Orchid Show'", "descriptor: 'The National Orchid Show Symposium — what it is, its theme, and who it is for.'", "href: '/national-show/tickets#ticket-day'", "href: '/national-show/tickets#ticket-weekend'"];
for (const w of want) if (!nav.includes(w)) fail(`nav-config.ts must contain ${w} (S2)`);
for (const old of ['19th SAOC National Orchid Show', 'SAOC Symposium', "'/tickets/day-visitor'", "'/tickets/weekend-pass'"]) if (nav.includes(old)) fail(`nav-config.ts still contains ${old} (S2)`);
const lines = (s) => new Set(s.split('\n').map((l) => l.trim()));
const added = [...lines(nav)].filter((l) => !lines(baseNav).has(l));
const removed = [...lines(baseNav)].filter((l) => !lines(nav).has(l));
if (added.length > 4 || removed.length > 4) fail(`nav-config.ts changes more than the four cleared lines (added ${added.length}, removed ${removed.length}) (S2)`);

const css = (readRepoFile(CSS) ?? '').replace(/\/\*[\s\S]{0,4000}?\*\//g, '');
if (!/\.nh-bar\s*\{[^}]*gap:\s*24px[^}]*padding:\s*13px var\(--nc-gutter\)/.test(css)) fail('.nh-bar keeps gap 24px and padding 13px var(--nc-gutter) (S3)');
if (!/\.nh\s*\{[^}]*position:\s*sticky/.test(css)) fail('.nh stays position: sticky from 700px (S3)');
if (!/@media \(max-width:\s*699px\)[\s\S]{0,400}\.nh\s*\{\s*position:\s*relative/.test(css)) fail('the 699px header stays position: relative, not sticky (S3)');
if (!/\.nh-bar\s*\{[^}]*flex-wrap:\s*wrap[^}]*padding-block:\s*16px 12px/.test(css)) fail('the 699px bar stays two rows with padding-block 16px 12px (S3)');
if (!/html:has\(#nh\)\s*\{\s*scroll-padding-top:\s*0/.test(css)) fail('the 699px html:has(#nh) scroll-padding-top: 0 rule stays (S3)');
for (const rel of [CSS, HEADER]) if (/--lk-/.test(readRepoFile(rel) ?? '')) fail(`${rel}: no --lk- variables (S3)`);
const head = stripComments(readRepoFile(HEADER) ?? '');
const baseHead = stripComments(readBaseFile(HEADER) ?? '');
const lockup = (s) => (s.match(/const LOCKUP_SRC[^\n]+/) ?? [''])[0];
if (!lockup(head) || lockup(head) !== lockup(baseHead)) fail('LOCKUP_SRC must stay unchanged (S3)');
if (/role="search"|type="search"|aria-label="Search/i.test(head)) fail('NosHeader must not carry a Search control (S3)');
for (const sel of ['.nf-list a', '.nf-legal a', '.nf-wild a']) if (!new RegExp(`${sel.replace(/\./g, '\\.')}[^{]*\\{[^}]*min-height:\\s*44px`).test(css)) fail(`${sel} needs min-height: 44px (S4)`);
for (const sel of ['.nh-burger', '.nh-cta']) if (!new RegExp(`${sel.replace(/\./g, '\\.')}\\s*\\{[^}]*min-height:\\s*44px`).test(css)) fail(`${sel} needs min-height: 44px (S4)`);

const doc = readRepoFile(DOC) ?? '';
if (!doc.includes('Brad chrome decision #2 and #6 (2026-10-15), via NOS Design 2026-10-17')) fail(`${DOC} must cite "Brad chrome decision #2 and #6 (2026-10-15), via NOS Design 2026-10-17" (S5)`);
if (!doc.includes("Left off NOS pages:** Search and SAOC's utility bar") && !doc.includes("Search and SAOC's utility bar")) fail(`${DOC} must quote HANDOFF decision 2 ("Search and SAOC's utility bar") (S5)`);
if (!doc.includes('Phone header:') || !doc.includes('two rows and not sticky')) fail(`${DOC} must quote HANDOFF decision 6 ("Phone header: two rows and not sticky") (S5)`);

finish(NAME, failures, 'F9: the NOS UtilityBar renders nothing, nav-config carries the four cleared strings, the approved header rules and 44px targets are kept, docs quote decisions #2 and #6.');
