// nos-critique-r3 F3 — static source check for R44 A5 (golden spec F3).
//   PresenterSection exports presenterSectionId() and PresenterJumpLink; the link renders null with no
//   presenters, derives its count from presenters.length (never a literal), points at the id on .pc-sec-top;
//   symposium/page.tsx renders it between the hero and PresenterSection; wosa-conference is untouched;
//   docs record R44 A5. Run as: node contracts/checks/nos-critique-r3/check-static-f3.mjs
import { SECTION, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); };
const NS = 'app/(marketing)/national-show';
const sectionRaw = readRepoFile(SECTION);
if (!sectionRaw) finish('check-static-f3.mjs', [`missing ${SECTION}`]);
const section = stripComments(sectionRaw);
const flat = section.replace(/\s+/g, ' ');

expect(/export function presenterSectionId\(/.test(section), 'must export presenterSectionId()');
expect(/export function PresenterJumpLink\(/.test(section), 'must export PresenterJumpLink');
const jump = section.slice(section.indexOf('export function PresenterJumpLink('));
expect(/length === 0\)\s*return null;/.test(jump), 'PresenterJumpLink must render nothing when there are no presenters');
expect(/Presenters \(\{presenters\.length\}\)/.test(jump.replace(/\s+/g, ' ')), 'the link text must be `Presenters ({presenters.length})`, derived from the list');
expect(/className="pc-jump-link"/.test(jump) && /className="pc-jump"/.test(jump) && /href=\{`#\$\{/.test(jump), 'link markup: .pc-jump > .pc-wrap > a.pc-jump-link href={`#${id}`}');
expect(/<div[^>]*className="pc-sec-top"[^>]*id=\{|<div[^>]*id=\{[^}]+\}[^>]*className="pc-sec-top"/.test(flat), 'the target id must sit on the div.pc-sec-top');
expect(!/\(4\)/.test(section), 'no hard-coded count');
const baseCopy = new Set(copyStrings(readBaseFile(SECTION)));
for (const c of copyStrings(sectionRaw)) {
  if (!baseCopy.has(c) && !/^Presenters \(/.test(c) && c !== 'To be confirmed by the show committee' && !/Sample sequence/.test(c)) failures.push(`new copy string in PresenterSection: ${JSON.stringify(c)}`);
}

// ---- symposium page ----
const sym = readRepoFile(`${NS}/symposium/page.tsx`);
if (!sym) failures.push('missing symposium page');
else {
  const f = sym.replace(/\s+/g, ' ');
  expect(/import \{[^}]*\bPresenterJumpLink\b[^}]*\} from '@\/components\/nos\/PresenterSection';/.test(f), 'symposium/page.tsx must import PresenterJumpLink');
  expect(/<ShowContentState\b[^>]*\bafterHero=\{<PresenterJumpLink presenters=\{presenters\} \/>\}/.test(f), 'symposium: <ShowContentState afterHero={<PresenterJumpLink presenters={presenters} />} /> (lead-cleared slot)');
  expect((f.match(/<PresenterJumpLink\b/g) || []).length === 1, 'symposium: the only <PresenterJumpLink> is the afterHero one (no standalone copy after the content wrapper)');
  expect(f.indexOf('<PresenterSection') > f.indexOf('<ShowContentState'), 'symposium: <PresenterSection> follows the hero block');
}
// ---- ShowContentState: the afterHero slot is the ONLY change ----
{
  const rel = 'components/show/nos/ShowContentState.tsx';
  const now = readRepoFile(rel);
  if (now === null) failures.push(`missing ${rel}`);
  else {
    const lines = (t) => stripComments(t).split('\n').map((l) => l.trim()).filter(Boolean);
    const before = lines(readBaseFile(rel));
    const after = lines(now);
    const added = after.filter((l) => !before.includes(l)).sort();
    const removed = before.filter((l) => !after.includes(l));
    expect(JSON.stringify(added) === JSON.stringify(['afterHero,', 'afterHero?: ReactNode;', '{afterHero}']), `ShowContentState: the only added lines must be the afterHero prop, its destructure and {afterHero} (got ${JSON.stringify(added)})`);
    expect(removed.length === 0, `ShowContentState: no line may be removed (got ${JSON.stringify(removed)})`);
    const f = now.replace(/\s+/g, ' ');
    expect(/<NosHero\b[^>]*\/> \{afterHero\} <div data-nos-content-state=/.test(f), 'ShowContentState: {afterHero} must sit directly after <NosHero …/> and before the data-nos-content-state div, with no wrapper');
  }
}
const wosa = readRepoFile(`${NS}/wosa-conference/page.tsx`);
expect(wosa !== null && !/PresenterJumpLink/.test(wosa), 'wosa-conference must not render the jump link (R44 A5 is symposium-only)');

// ---- docs ----
const docs = readRepoFile('docs/nos-critique-r3.md');
expect(docs !== null && /R44/.test(docs) && /scroll-margin/.test(docs) && /768/.test(docs), 'docs/nos-critique-r3.md must record R44 A5 (jump link, scroll-margin, 2-up from 768)');

finish('check-static-f3.mjs', failures, 'R44 jump link wiring matches the golden: derived count, null when empty, symposium-only, id on .pc-sec-top.');
