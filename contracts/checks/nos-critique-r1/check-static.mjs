// nos-critique-r1 F1 — static checks on the three cleared page files (golden §2, §3).
//   sponsors: the RealEmptyListing scaffold ("Each entry will show / Sponsor / Tier / Website")
//     is gone; a page-local G2 empty state renders, in order, the sourced heading "Become a
//     sponsor" (app/(marketing)/sponsors/page.tsx:109), the R11 chip <ConfirmationBadge
//     status="pending" pendingLabel="To be confirmed by the show committee" />, one line
//     "No Show sponsors have been confirmed for 2027 yet." (the first sentence of the existing
//     ABSENCE_STATEMENT), and <Button as="a" href="mailto:info@saoc.co.za">Talk to us about
//     sponsorship</Button> (app/(marketing)/sponsors/page.tsx:119).
//   all three pages: ShowContentState is wrapped page-locally in a `contents` element that
//     caps descendant prose at 60ch; no copy string is added beyond the three sourced ones.
//
// Run as: node contracts/checks/nos-critique-r1/check-static.mjs
import { FILES, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static.mjs';
const failures = [];
const HEADING = 'Become a sponsor';
const CHIP = 'To be confirmed by the show committee';
const LINE = 'No Show sponsors have been confirmed for 2027 yet.';
const CTA = 'Talk to us about sponsorship';
const ALLOWED_NEW_COPY = new Set([HEADING, CHIP, LINE, CTA]);
const WRAPPER_RE = /<div\s+className="contents\s+\[&_\[data-nos-content-state\]_p\]:max-w-\[60ch\]\s+\[&_\[data-nos-content-state\]_li\]:max-w-\[60ch\]"\s*>\s*<ShowContentState\b/;

function noNewCopy(rel, src) {
  const base = copyStrings(readBaseFile(rel));
  const pool = [...base];
  for (const t of copyStrings(src)) {
    const i = pool.indexOf(t);
    if (i >= 0) pool.splice(i, 1);
    else if (!ALLOWED_NEW_COPY.has(t)) failures.push(`${rel}: new copy string not traceable to a source: ${JSON.stringify(t)}`);
  }
}

for (const key of ['sponsors', 'symposium', 'wosa']) {
  const rel = FILES[key];
  const raw = readRepoFile(rel);
  if (!raw) { failures.push(`missing ${rel}`); continue; }
  const src = stripComments(raw);
  noNewCopy(rel, raw);
  if (!WRAPPER_RE.test(src)) {
    failures.push(`${rel}: <ShowContentState> must be the first child of <div className="contents [&_[data-nos-content-state]_p]:max-w-[60ch] [&_[data-nos-content-state]_li]:max-w-[60ch]">`);
  }
  if ((src.match(/<ShowContentState\b/g) || []).length !== 1) failures.push(`${rel}: exactly one <ShowContentState>`);
  if (/max-w-\[(6[1-9]|[7-9]\d|\d{3})ch\]/.test(src)) failures.push(`${rel}: no prose cap wider than 60ch`);
}

// ---- sponsors G2 ----
{
  const rel = FILES.sponsors;
  const raw = readRepoFile(rel);
  if (raw) {
    const src = stripComments(raw);
    if (/RealEmptyListing/.test(src)) failures.push(`${rel}: must not import or render RealEmptyListing (the scaffold)`);
    if (/Each entry will show|CARD_FIELD_LABELS|'Tier'/.test(src)) failures.push(`${rel}: scaffold field labels must be gone`);
    if (!/import\s*\{\s*Card\s*\}\s*from\s*'@\/components\/nos\/Card'/.test(src)) failures.push(`${rel}: import { Card } from '@/components/nos/Card'`);
    if (!/import\s*\{\s*SectionHeading\s*\}\s*from\s*'@\/components\/nos\/SectionHeading'/.test(src)) failures.push(`${rel}: import { SectionHeading } from '@/components/nos/SectionHeading'`);
    const card = src.indexOf('<Card data-nos-empty-state="sponsors"');
    const heading = src.indexOf(`<SectionHeading title="${HEADING}" />`);
    const chip = src.indexOf(`<ConfirmationBadge status="pending" pendingLabel="${CHIP}" />`);
    const line = src.search(/<p className="[^"]*">\{NO_SPONSORS_YET\}<\/p>/);
    const cta = src.search(new RegExp(`<Button as="a" href="mailto:info@saoc\\.co\\.za">\\s*${CTA}\\s*</Button>`));
    const close = src.indexOf('</Card>');
    if (card < 0) failures.push(`${rel}: G2 container <Card data-nos-empty-state="sponsors" ...> not found`);
    if (heading < 0) failures.push(`${rel}: <SectionHeading title="${HEADING}" /> not found`);
    if (chip < 0) failures.push(`${rel}: <ConfirmationBadge status="pending" pendingLabel="${CHIP}" /> not found`);
    if (line < 0) failures.push(`${rel}: <p className="...">{NO_SPONSORS_YET}</p> not found`);
    if (cta < 0) failures.push(`${rel}: <Button as="a" href="mailto:info@saoc.co.za">${CTA}</Button> not found`);
    if ([card, heading, chip, line, cta, close].every((n) => n >= 0) && !(card < heading && heading < chip && chip < line && line < cta && cta < close)) {
      failures.push(`${rel}: G2 order must be Card > heading > R11 chip > line > CTA`);
    }
    if (!raw.includes(`const NO_SPONSORS_YET = '${LINE}';`)) failures.push(`${rel}: const NO_SPONSORS_YET = '${LINE}';`);
    if (/ABSENCE_STATEMENT|as the Council signs off/.test(src)) failures.push(`${rel}: the unsourced timing promise (ABSENCE_STATEMENT second sentence) must be gone`);
    if ((src.match(/<ConfirmationBadge\b/g) || []).length !== 1) failures.push(`${rel}: exactly one ConfirmationBadge`);
    if ((src.match(/<Button\b/g) || []).length !== 1) failures.push(`${rel}: exactly one Button`);
    if (/href="\/contact"/.test(src)) failures.push(`${rel}: all contact goes to info@saoc.co.za (Brad), not /contact`);
    if (/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(src)) failures.push(`${rel}: no date may be written`);
    if (!/list\.length > 0 \?\s*\(?\s*<ShowEntityGrid/.test(src)) failures.push(`${rel}: the real sponsor grid must still render when sponsors exist`);
  }
}

finish(NAME, failures, 'sponsors G2 empty state is sourced and ordered; prose capped at 60ch page-locally on all three pages; no unsourced copy added.');
