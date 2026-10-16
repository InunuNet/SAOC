// nos-audit-fixes item 4 — R7 disclosures with the existing ConfirmationBadge marker (golden §4).
// Status is `pending` ("To be confirmed"), not `research`: per
// contracts/golden/show-visitor-info/confirmation-status-model.golden.md, `pending` is the value we
// made up as scaffolding and `research` is real, verified-by-us data. Neither copy here is either.
//   /national-show/archive (re-baselined by launch-weekend F6): the invented per-edition stats are gone.
//     The empty state is the R11 surface - a <ConfirmationBadge status="pending" /> chip, the sentence
//     "Show history awaiting committee records", on a dashed 2px rail - and a tile for a real Sanity
//     show carries one pending chip and no entries/exhibitors/visitors/trophies stat.
//   /national-show/conferences: the lede naming a "Joint track" is followed by
//     note={<ConfirmationBadge status="pending" />} on CategoryTicketsPage.
// No label override props (the fallback label is the existing copy), and the lede,
// description markup are unchanged.
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
    if (tags.length !== 2) failures.push(`${rel}: expected exactly 2 ConfirmationBadge (one per tile inside the map, one in the empty state), found ${tags.length}`);
    const sentence = src.indexOf('Show history awaiting committee records');
    if (sentence < 0) failures.push(`${rel}: empty state sentence "Show history awaiting committee records" missing`);
    const rail = src.search(/border-l-2[^"]*border-dashed|border-dashed[^"]*border-l-2/);
    if (rail < 0) failures.push(`${rel}: empty state must sit on the R11 dashed 2px rail (border-l-2 border-dashed)`);
    else if (sentence >= 0 && !(rail < sentence && tags.some((t) => t.start > rail && t.start < sentence))) {
      failures.push(`${rel}: empty state order must be rail, then chip, then sentence`);
    }
    for (const s of ['entries</Badge>', 'exhibitors</Badge>', 'visitors</Badge>', 'trophies</Badge>', 'show.trophies', 'show.visitors']) {
      if (src.includes(s)) failures.push(`${rel}: invented stat "${s}" must not render (F6 archive honesty)`);
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

finish(NAME, failures, 'archive empty state and tiles, and the conferences Joint-track lede, carry ConfirmationBadge status="pending" with the existing label; no invented archive stat.');
