// nos-audit-fixes item 4 — R7 disclosures with the existing ConfirmationBadge marker (golden §4).
// Status is `pending` ("To be confirmed"), not `research`: per
// contracts/golden/show-visitor-info/confirmation-status-model.golden.md, `pending` is the value we
// made up as scaffolding and `research` is real, verified-by-us data. Neither copy here is either.
//   /national-show/archive: the per-edition stats (entries/exhibitors/visitors/trophies, from
//     lib/data/shows.ts or Sanity, no cited source) are followed, inside the same stats
//     conditional, by exactly one <ConfirmationBadge status="pending" /> ("To be confirmed").
//   /national-show/conferences: the lede naming a "Joint track" is followed by
//     note={<ConfirmationBadge status="pending" />} on CategoryTicketsPage.
// No label override props (the fallback label is the existing copy), and the lede,
// description and stats markup are unchanged.
//
// Run as: node contracts/checks/nos-audit-fixes/check-disclosures.mjs
import { finish, openingTags, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-disclosures.mjs';
const failures = [];
const IMPORT_RE = /import\s*\{[^}]*\bConfirmationBadge\b[^}]*\}\s*from\s*'@\/components\/show'/;

function badges(src, label) {
  const tags = openingTags(src, 'ConfirmationBadge');
  for (const t of tags) {
    if (!/\bstatus="pending"/.test(t.text)) failures.push(`${label}: ConfirmationBadge must pass status="pending" (${t.text})`);
    if (/\b(researchLabel|pendingLabel)=/.test(t.text)) failures.push(`${label}: no label override — the existing fallback label is the copy`);
    if (/\btone="dark"/.test(t.text)) failures.push(`${label}: both placements sit on a light ground; tone must stay light`);
  }
  return tags;
}

// ---- archive ----
{
  const rel = 'app/(marketing)/national-show/archive/page.tsx';
  const raw = readRepoFile(rel);
  if (!raw) failures.push(`missing ${rel}`);
  else {
    const src = stripComments(raw);
    if (!IMPORT_RE.test(src)) failures.push(`${rel}: import ConfirmationBadge from '@/components/show'`);
    const tags = badges(src, rel);
    if (tags.length !== 1) failures.push(`${rel}: expected exactly 1 ConfirmationBadge (one per card, inside the map), found ${tags.length}`);
    const condStart = src.search(/\(show\.entries \|\| show\.exhibitors \|\| show\.visitors \|\| show\.trophies\) &&/);
    const statsRowEnd = src.indexOf('trophies</Badge>}');
    const noteStart = src.indexOf('{show.note &&');
    if (condStart < 0 || statsRowEnd < 0 || noteStart < 0) failures.push(`${rel}: stats conditional / stats row / note markers not found unchanged`);
    else if (tags[0]) {
      const at = tags[0].start;
      if (!(at > statsRowEnd && at < noteStart)) failures.push(`${rel}: ConfirmationBadge must sit after the stats badge row and before show.note`);
      // Must be inside the stats conditional: the conditional's own `)}` closes AFTER the badge.
      const between = src.slice(tags[0].end, noteStart);
      if (!/^\s*<\/>\s*\)\}\s*$/.test(between)) {
        failures.push(`${rel}: the stats conditional must render <>{stats row}<ConfirmationBadge status="pending" /></> — badge as the fragment's last child`);
      }
      if (!/show\.trophies\) &&\s*\(?\s*<>/.test(src)) {
        failures.push(`${rel}: the stats conditional body must open a fragment <> so the badge renders only when stats render`);
      }
    }
    for (const s of ['entries</Badge>', 'exhibitors</Badge>', 'visitors</Badge>', 'trophies</Badge>']) {
      if (!src.includes(s)) failures.push(`${rel}: stats badge "${s}" must be unchanged`);
    }
  }
}

// ---- conferences ----
{
  const rel = 'app/(marketing)/national-show/conferences/page.tsx';
  const raw = readRepoFile(rel);
  if (!raw) failures.push(`missing ${rel}`);
  else {
    const src = stripComments(raw);
    if (!IMPORT_RE.test(src)) failures.push(`${rel}: import ConfirmationBadge from '@/components/show'`);
    const tags = badges(src, rel);
    if (tags.length !== 1) failures.push(`${rel}: expected exactly 1 ConfirmationBadge, found ${tags.length}`);
    if (!/note=\{\s*<ConfirmationBadge\s+status="pending"\s*\/>\s*\}/.test(src)) {
      failures.push(`${rel}: CategoryTicketsPage must receive note={<ConfirmationBadge status="pending" />}`);
    }
    const LEDE =
      'lede="Register for the SAOC Symposium, the WOSA Conference, or the combined SAOC/WOSA Joint track at the National Show."';
    if (!src.includes(LEDE)) failures.push(`${rel}: lede must be unchanged (copy is not rewritten here)`);
    if (!src.includes("'Register for the SAOC Symposium, the WOSA Conference, or the combined SAOC/WOSA Joint '")) {
      failures.push(`${rel}: metadata description must be unchanged`);
    }
  }
}

// ---- the components themselves are not edited for this item ----
for (const rel of ['components/tickets/CategoryTicketsPage.tsx', 'components/show/ConfirmationBadge.tsx', 'components/show/_shared/StatusMarker.tsx']) {
  if (!readRepoFile(rel)) failures.push(`missing ${rel}`);
}

finish(NAME, failures, 'archive stats and the conferences Joint-track lede each carry one ConfirmationBadge status="pending" with the existing label; copy unchanged.');
