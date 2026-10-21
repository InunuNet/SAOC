// nos-critique-r9 f3 static (fractional-width media gap, interim QA P3): the chip's media steps must be written so no width between two integer steps falls through.
//   S1  no integer complement pairs in StatusMarker, ShowStatusLine, VisitDisclosure: no max-width:359px, 374px or 419px and no min-width:360px, 375px or 420px
//   S2  the narrow steps use range syntax: (width<360px) in StatusMarker (at least twice, the full label and the short tag), (width<375px) and (width<420px) in ShowStatusLine and VisitDisclosure
//   S3  the top step stays inclusive at 700: (width<=700px) or max-width:700px. A 420..700 band is allowed only as a range complement ((width>=420px) against (width<420px), the
//       F18b disjoint-band form on main 81490e7a): the intent is no fractional-width gap, which S1 enforces by forbidding the integer min-width:420px
//   S4  docs/nos-critique-r9.md exists
import { DOC, finish, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const FILES = ['components/show/_shared/StatusMarker.tsx', 'components/show/ShowStatusLine.tsx', 'components/show/VisitDisclosure.tsx'];
const text = {};
for (const rel of FILES) {
  const raw = readRepoFile(rel);
  if (raw === null) { fail(`${rel} is missing`); continue; }
  text[rel] = stripComments(raw).replace(/\s+/g, '');
  const bad = text[rel].match(/(max-width:(359|374|419)px)|(min-width:(360|375|420)px)/g);
  if (bad) fail(`${rel}: integer-complement media ${[...new Set(bad)].join(', ')} leaves a gap at fractional widths; use (width<360px), (width<375px), (width<420px) (S1)`);
}
const marker = text[FILES[0]];
if (marker && (marker.match(/\(width<360px\)/g) ?? []).length < 2) fail(`${FILES[0]}: the full label and the short tag must both switch on (width<360px) (S2)`);
for (const rel of FILES.slice(1)) {
  const t = text[rel];
  if (!t) continue;
  for (const step of ['375', '420']) if (!t.includes(`(width<${step}px)`)) fail(`${rel}: missing the (width<${step}px) tracking step (S2)`);
  if (!/\(width<=700px\)|max-width:700px/.test(t)) fail(`${rel}: the 700px step must stay inclusive: (width<=700px) or max-width:700px (S3)`);
}
if (readRepoFile(DOC) === null) fail(`${DOC} is missing (S4)`);

finish('f3-static.mjs', failures, 'StatusMarker, ShowStatusLine and VisitDisclosure switch on (width<360px), (width<375px), (width<420px) and an inclusive 700, with no integer-complement pair.');
