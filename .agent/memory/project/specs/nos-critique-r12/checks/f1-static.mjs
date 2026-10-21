// nos-critique-r12 f1 static (pre-existing provenance items routed by the lead; goldens/f1-spec.md, goldens/supersession.json).
//   S1  (a) archive: the manifest purpose is "Previous editions." in scripts/generate-nos-route-manifest.ts and content/national-show-routes.json, the string 6f805df0 trimmed the nav
//       descriptor to ("no champions/galleries promise"); each file equals BASE with exactly that one line changed, and no "their champions" survives in either
//   S1b (b) symposium (lead ruling 2026-10-18, applying launch-weekend f18-spec.md:122/:181 'end to end'): the manifest purpose is the nav-config.ts:216 descriptor string,
//       'The National Orchid Show Symposium — what it is, its theme, and who it is for.', in the generator and the manifest; again exactly one line each.
//       Addendum (lead 2026-10-18, same ruling): the symposium `label` line in both files becomes ShowSectionNav.tsx:68's 'National Orchid Show Symposium'
//   S2  check-descriptor-provenance is fully green (exit 0, its OK line), no held row
//   S3  (c) check-featurerail-blurb-provenance.mjs opens with the RETIRED header (citing f8-tickets-rail.json blurbRemoved and the r12 supersession) and its body is BASE's, unchanged
//   S4  (d) check-labels-static.mjs re-pins only the vendors title (F24 911fd349), keeps OLD_PATTERN with Exhibiting Nurseries and Trade Vendors, and runs green, and so does
//       launch-weekend F18-A13 (check-l-supersession.mjs, which spawns it)
//   S5  docs/nos-critique-r12.md exists
//   S6  every ShowSectionNav SECTION_LINKS label equals its route's label in content/national-show-routes.json and the generator (the invariant ShowSectionNav.tsx:37 claims)
import { execFileSync } from 'node:child_process';

import { DOC, finish, readBaseFile, readRepoFile, repoRoot, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const run = (rel) => {
  try {
    return { code: 0, out: execFileSync('node', [rel], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};
const edits = new Map();
const oneLineEdit = (rel, from, to) => {
  const head = readRepoFile(rel);
  const base = readBaseFile(rel);
  if (head === null || base === null) return fail(`${rel} is missing at HEAD or BASE`);
  if (base.split(from).length !== 2) return fail(`${rel}: BASE does not hold exactly one ${JSON.stringify(from)}; BASE is not the audited 26fde668`);
  edits.set(rel, [...(edits.get(rel) ?? []), [from, to]]);
};

oneLineEdit('scripts/generate-nos-route-manifest.ts', "    purpose: 'Previous editions and their champions.',\n", "    purpose: 'Previous editions.',\n");
oneLineEdit('content/national-show-routes.json', '      "purpose": "Previous editions and their champions.",\n', '      "purpose": "Previous editions.",\n');
for (const rel of ['scripts/generate-nos-route-manifest.ts', 'content/national-show-routes.json']) if (/their champions/.test(readRepoFile(rel) ?? '')) fail(`${rel} still promises champions (S1)`);
const SYMP = 'The National Orchid Show Symposium — what it is, its theme, and who it is for.';
if (!(readRepoFile('components/chrome/nav-config.ts') ?? '').includes(`descriptor: '${SYMP}',`)) fail('nav-config.ts no longer carries the symposium descriptor the manifest is aligned to (S1b)');
oneLineEdit('scripts/generate-nos-route-manifest.ts', '    purpose: "The SAOC Symposium — what it is, its theme, and who it is for.",\n', `    purpose: "${SYMP}",\n`);
oneLineEdit('content/national-show-routes.json', '      "purpose": "The SAOC Symposium — what it is, its theme, and who it is for.",\n', `      "purpose": "${SYMP}",\n`);
const SYMP_LABEL = 'National Orchid Show Symposium';
oneLineEdit('scripts/generate-nos-route-manifest.ts', "    label: 'SAOC Symposium',\n", `    label: '${SYMP_LABEL}',\n`);
oneLineEdit('content/national-show-routes.json', '      "label": "SAOC Symposium",\n', `      "label": "${SYMP_LABEL}",\n`);

const dp = run('contracts/checks/menu-system-layout4-f1/check-descriptor-provenance.mjs');
if (dp.code !== 0) fail(`check-descriptor-provenance is red: ${dp.out.split('\n').filter((l) => /^\s+- /.test(l)).join(' | ').slice(0, 300) || dp.out.slice(0, 200)} (S2)`);
else if (!/^OK -- /m.test(dp.out)) fail('check-descriptor-provenance exited 0 without its OK line (S2)');

const FR = 'contracts/checks/menu-system-layout4-f7/check-featurerail-blurb-provenance.mjs';
const fr = readRepoFile(FR);
const frBase = readBaseFile(FR);
if (fr === null || frBase === null) fail(`${FR} is missing at HEAD or BASE (S3)`);
else {
  const header = fr.slice(0, fr.length - frBase.length);
  if (!fr.endsWith(frBase)) fail(`${FR}: only a header may be added above BASE's unchanged body (S3)`);
  else if (!/^\/\/ RETIRED \(nos-critique-r12/.test(header) || !/f8-tickets-rail\.json/.test(header) || !/blurbRemoved/.test(header) || !/nos-critique-r12\/goldens\/supersession\.json/.test(header) || header.split('\n').some((l) => l && !l.startsWith('//'))) fail(`${FR}: the added header must be comment lines opening "// RETIRED (nos-critique-r12" and cite f8-tickets-rail.json blurbRemoved and nos-critique-r12/goldens/supersession.json (S3)`);
}

const LS = 'contracts/checks/vendor-p1-targets/check-labels-static.mjs';
oneLineEdit(LS, "  ['app/(marketing)/national-show/vendors/page.tsx', `title: '${NEW} — National Show',`],\n", "  ['app/(marketing)/national-show/vendors/page.tsx', `title: '${NEW}',`], // F24 911fd349: the NOS layout template adds the suffix (nos-critique-r12 supersession)\n");
const ls = run(LS);
if (ls.code !== 0) fail(`check-labels-static is red: ${ls.out.split('\n')[0]} (S4)`);
const l13 = run('contracts/checks/launch-weekend/f18/check-l-supersession.mjs');
if (l13.code !== 0) fail(`launch-weekend F18-A13 check-l-supersession is red (it spawns check-labels-static): ${l13.out.split('\n').find((l) => /FAIL|problem/i.test(l)) ?? l13.out.slice(0, 160)} (S4)`);

for (const [rel, list] of edits) {
  const want = list.reduce((t, [from, to]) => t.replace(from, to), readBaseFile(rel));
  if (readRepoFile(rel) !== want) fail(`${rel} must equal BASE with only ${list.map(([f, t]) => `${JSON.stringify(f.trim())} -> ${JSON.stringify(t.trim())}`).join(' and ')} (S1/S1b/S4)`);
}

if (readRepoFile(DOC) === null) fail(`${DOC} is missing (S5)`);

// S6
{
  const nav = stripComments(readRepoFile('components/show/ShowSectionNav.tsx') ?? '');
  const links = [...nav.matchAll(/href: '([^']+)',\s*label: '([^']+)'/g)].map((m) => [m[1], m[2]]);
  const manifest = JSON.parse(readRepoFile('content/national-show-routes.json') ?? '{"routes":[]}').routes;
  const generator = new Map([...stripComments(readRepoFile('scripts/generate-nos-route-manifest.ts') ?? '').matchAll(/slug: '([^']+)',\s*label: '([^']+)'/g)].map((m) => [m[1], m[2]]));
  if (links.length !== 17) fail(`ShowSectionNav lists ${links.length} links, want the 17 its comment names (S6)`);
  if (!links.some(([h, l]) => h === '/national-show/symposium' && l === SYMP_LABEL)) fail(`ShowSectionNav no longer labels /national-show/symposium '${SYMP_LABEL}' (S6)`);
  for (const [href, label] of links) {
    const row = manifest.find((r) => r.slug === href);
    if (!row) fail(`${href}: in ShowSectionNav but not in content/national-show-routes.json (S6)`);
    else if (row.label !== label) fail(`${href}: ShowSectionNav label '${label}', manifest label '${row.label}' (S6)`);
    if (generator.get(href) !== label) fail(`${href}: ShowSectionNav label '${label}', generator label '${generator.get(href)}' (S6)`);
  }
}

finish('f1-static.mjs', failures, 'archive and symposium manifest purposes match their nav descriptors and every ShowSectionNav label matches the manifest and generator, descriptor provenance is fully green, the featureRail blurb check is RETIRED, and check-labels-static is re-pinned to the F24 title and green.');
