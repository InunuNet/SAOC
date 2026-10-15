// nos-audit-fixes item 5 — R18/6 + R7: the /national-show/sponsors empty listing carries a
// sponsorship-enquiry action, and its unsourced "when" wording is marked (golden §5).
//   - RealEmptyListing gains TWO optional props, both ReactNode:
//       absenceMarker — rendered directly after the absence statement, before the
//                       "Each entry will show" block (it scopes the marker to that sentence);
//       action        — rendered after the field-label block (R18/5 order: what, when, action).
//     The component itself stays generic: no marker or disclosure is hardcoded in it.
//   - sponsors passes absenceMarker={<ConfirmationBadge status="pending" />} (existing
//     fallback label "To be confirmed"; the absence wording has no council source) and
//     action = NOS <Button as="a" href="mailto:info@saoc.co.za"> labelled with the site's
//     existing sponsorship label "Talk to us about sponsorship"
//     (app/(marketing)/sponsors/page.tsx:119);
//   - sa-exhibitors and international-guests pass neither prop (out of scope; R18/6);
//   - ABSENCE_STATEMENT is unchanged, no date is written, and no R11 (AI-placeholder)
//     disclosure is stacked on the panel (R18/7) — the ConfirmationBadge is the per-claim
//     confirmation marker, not the R11 notice.
//
// Run as: node contracts/checks/nos-audit-fixes/check-sponsor-enquiry.mjs
import { finish, openingTags, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-sponsor-enquiry.mjs';
const failures = [];
const NOS = 'app/(marketing)/national-show';
const LABEL = 'Talk to us about sponsorship';
const ABSENCE =
  "'No Show sponsors have been confirmed for 2027 yet. Confirmed sponsors will appear ' +\n" +
  "  'here, one card per sponsor, as the Council signs off each partnership ahead of the show.'";
const R11_RE = /FALLBACK_|nos-show-page-notice|AI-generated|Placeholder copy|ShowPageNotice|data-nos-provenance/;
const MARKER_RE = /ConfirmationBadge|StatusMarker|ExhibitorStatusBadge/;

// ---- the site's own label exists where the golden cites it ----
const siteSponsors = readRepoFile('app/(marketing)/sponsors/page.tsx');
if (!siteSponsors || !siteSponsors.includes(LABEL)) failures.push(`cited label source app/(marketing)/sponsors/page.tsx no longer contains "${LABEL}"`);

// ---- RealEmptyListing ----
{
  const rel = 'components/show/nos/RealEmptyListing.tsx';
  const raw = readRepoFile(rel);
  if (!raw) failures.push(`missing ${rel}`);
  else {
    const src = stripComments(raw);
    if (!/import\s+type\s*\{[^}]*\bReactNode\b[^}]*\}\s*from\s*'react'/.test(src)) failures.push(`${rel}: import type { ReactNode } from 'react'`);
    const iface = src.match(/export interface RealEmptyListingProps\s*\{([\s\S]*?)\n\}/);
    if (!iface) failures.push(`${rel}: RealEmptyListingProps not found`);
    else {
      for (const p of ['absenceMarker', 'action']) {
        if (!new RegExp(`\\b${p}\\?\\s*:\\s*ReactNode\\s*;`).test(iface[1])) failures.push(`${rel}: RealEmptyListingProps needs optional "${p}?: ReactNode;"`);
      }
      if (!/\bfieldLabels\s*:\s*readonly string\[\]\s*;/.test(iface[1]) || !/\babsenceStatement\s*:\s*string\s*;/.test(iface[1])) {
        failures.push(`${rel}: fieldLabels / absenceStatement must keep their existing required types`);
      }
      const keys = (iface[1].match(/^\s*(\w+)\??\s*:/gm) || []).map((k) => k.trim().replace(/\??\s*:$/, ''));
      const want = ['absenceMarker', 'absenceStatement', 'action', 'fieldLabels'];
      if ([...keys].sort().join() !== want.join()) failures.push(`${rel}: props must be exactly ${want.join(', ')} (got ${keys.join(', ')})`);
    }
    if (!/RealEmptyListing\(\{\s*fieldLabels,\s*absenceStatement,\s*absenceMarker,\s*action,?\s*\}/.test(src)) {
      failures.push(`${rel}: destructure { fieldLabels, absenceStatement, absenceMarker, action }`);
    }
    if (!src.includes('<p className="font-sans text-[15px] leading-relaxed text-ink/80">{absenceStatement}</p>')) {
      failures.push(`${rel}: the absence statement paragraph must be unchanged`);
    }
    const stmt = src.indexOf('{absenceStatement}</p>');
    const each = src.indexOf('Each entry will show');
    const dlClose = src.indexOf('</dl>');
    const marker = src.search(/\{absenceMarker\s*(\?|&&)/);
    const action = src.search(/\{action\s*(\?|&&)/);
    if (marker < 0) failures.push(`${rel}: absenceMarker must render conditionally ({absenceMarker ? ... : null} or {absenceMarker && ...})`);
    else if (!(stmt > 0 && marker > stmt && marker < each)) failures.push(`${rel}: absenceMarker must render after the absence statement and before "Each entry will show"`);
    if (action < 0) failures.push(`${rel}: action must render conditionally ({action ? ... : null} or {action && ...})`);
    else if (!(each > 0 && dlClose > each && action > dlClose)) failures.push(`${rel}: action must render after the "Each entry will show" field-label block`);
    if (R11_RE.test(src) || MARKER_RE.test(src)) failures.push(`${rel}: the component stays generic — no marker or disclosure hardcoded in it`);
  }
}

// ---- sponsors page ----
{
  const rel = `${NOS}/sponsors/page.tsx`;
  const raw = readRepoFile(rel);
  if (!raw) failures.push(`missing ${rel}`);
  else {
    const src = stripComments(raw);
    if (!raw.includes(ABSENCE)) failures.push(`${rel}: ABSENCE_STATEMENT must be unchanged`);
    if (!/import\s*\{\s*Button\s*\}\s*from\s*'@\/components\/nos\/Button'/.test(src)) failures.push(`${rel}: import { Button } from '@/components/nos/Button'`);
    if (!/import\s*\{[^}]*\bConfirmationBadge\b[^}]*\}\s*from\s*'@\/components\/show'/.test(src)) failures.push(`${rel}: import ConfirmationBadge from '@/components/show'`);
    const listings = openingTags(src, 'RealEmptyListing');
    if (listings.length !== 1) failures.push(`${rel}: expected 1 RealEmptyListing, found ${listings.length}`);
    const t = listings[0];
    if (t && !/\baction=\{/.test(t.text)) failures.push(`${rel}: RealEmptyListing must receive action={...}`);
    if (t && !/\babsenceMarker=\{\s*<ConfirmationBadge\s+status="pending"\s*\/>\s*\}/.test(t.text)) {
      failures.push(`${rel}: RealEmptyListing must receive absenceMarker={<ConfirmationBadge status="pending" />}`);
    }
    const badges = openingTags(src, 'ConfirmationBadge');
    if (badges.length !== 1) failures.push(`${rel}: expected exactly 1 ConfirmationBadge, found ${badges.length}`);
    for (const b of badges) {
      if (/\b(researchLabel|pendingLabel|tone)=/.test(b.text)) failures.push(`${rel}: no label/tone override — the existing fallback label is the copy`);
    }
    const buttons = openingTags(src, 'Button');
    const mail = buttons.filter((b) => /href="mailto:info@saoc\.co\.za"/.test(b.text));
    if (mail.length !== 1) failures.push(`${rel}: expected 1 <Button ... href="mailto:info@saoc.co.za">, found ${mail.length}`);
    if (buttons.length !== mail.length) failures.push(`${rel}: no other Button may be added`);
    for (const b of mail) {
      if (!/\bas="a"/.test(b.text)) failures.push(`${rel}: the enquiry Button must render as="a" (a mailto is navigation, not a Link route)`);
      if (/\bvariant="(on-dark|ghost-on-dark)"/.test(b.text)) failures.push(`${rel}: the panel is a light ground; no on-dark variant`);
      if (/\bclassName=/.test(b.text)) failures.push(`${rel}: no className override on the enquiry Button — the shared Button is the design`);
      if (t && !(b.start > t.start && b.start < t.end)) failures.push(`${rel}: the enquiry Button must be the RealEmptyListing action prop`);
      const after = src.slice(b.end, b.end + 80);
      if (!new RegExp(`^\\s*${LABEL}\\s*</Button>`).test(after)) failures.push(`${rel}: Button label must be exactly "${LABEL}"`);
    }
    if (/href="\/contact"/.test(src)) failures.push(`${rel}: all contact goes to info@saoc.co.za (Brad), not /contact`);
    if (/\b(January|February|March|April|May|June|July|August|September|October|November|December|20[2-3]\d-\d\d)\b/.test(src.replace(ABSENCE, ''))) {
      failures.push(`${rel}: no date may be written (R7/R18/5)`);
    }
    if (R11_RE.test(src)) failures.push(`${rel}: no R11 (AI-placeholder) disclosure stacked on the empty listing (R18/7)`);
  }
}

// ---- the other two R18 pages take neither prop ----
for (const dir of ['sa-exhibitors', 'international-guests']) {
  const rel = `${NOS}/${dir}/page.tsx`;
  const src = readRepoFile(rel);
  if (!src) failures.push(`missing ${rel}`);
  else if (/<RealEmptyListing[^>]*\b(action|absenceMarker)=/.test(src)) failures.push(`${rel}: must not pass action or absenceMarker (out of scope; R18/6)`);
}

finish(NAME, failures, `sponsors empty listing carries a "To be confirmed" marker on its absence sentence and "${LABEL}" -> mailto:info@saoc.co.za; other R18 pages unchanged; no date, no R11 disclosure.`);
