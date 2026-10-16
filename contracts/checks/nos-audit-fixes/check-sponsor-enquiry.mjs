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
    // R43 (NOS Design via the lead, 2026-10-16, nos-critique-r3) supersedes: the statement is running prose, so it takes the 17px body role (was text-[15px]).
    if (!src.includes('<p className="font-sans text-[17px] leading-relaxed text-ink/80">{absenceStatement}</p>')) {
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
// Re-baselined by nos-critique-r3 (2026-10-16): origin/main 242f51fb's sponsors page no longer renders RealEmptyListing (nos-critique-r1 G2
// designed empty state), so its page-level pins were stale against the base and r3 never touches that file. Only the RealEmptyListing component pins remain.

// ---- the other two R18 pages take neither prop ----
for (const dir of ['sa-exhibitors', 'international-guests']) {
  const rel = `${NOS}/${dir}/page.tsx`;
  const src = readRepoFile(rel);
  if (!src) failures.push(`missing ${rel}`);
  else if (/<RealEmptyListing[^>]*\b(action|absenceMarker)=/.test(src)) failures.push(`${rel}: must not pass action or absenceMarker (out of scope; R18/6)`);
}

finish(NAME, failures, `RealEmptyListing keeps its generic action/absenceMarker props and 17px statement; sa-exhibitors and international-guests pass neither prop.`);
