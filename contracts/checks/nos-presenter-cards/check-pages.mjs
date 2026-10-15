// nos-presenter-cards F2 — page wiring (golden §1, §9). Static source check.
//   - symposium and wosa-conference each render <PresenterSection> under their existing
//     hero (after <ShowContentState>, before <ShowSectionNav>) with the golden eyebrow;
//   - `void presenters` is gone; no new route; no "Presenter Profiles" page;
//   - the national-show layout imports presenters.css and loads Fraunces with the opsz axis
//     (weights 300/400 come from the variable font) and Karla 700.
//
// Run as: node contracts/checks/nos-presenter-cards/check-pages.mjs
import { existsSync, readdirSync, statSync } from 'node:fs';

import { finish, readRepoFile, repoPath } from './_lib.mjs';

const failures = [];
const expect = (ok, msg) => {
  if (!ok) failures.push(msg);
};

const PAGES = [
  { rel: 'app/(marketing)/national-show/symposium/page.tsx', eyebrow: 'Symposium', event: 'saoc-symposium' },
  { rel: 'app/(marketing)/national-show/wosa-conference/page.tsx', eyebrow: 'WOSA Conference', event: 'wosa-conference' },
];

for (const page of PAGES) {
  const src = readRepoFile(page.rel);
  if (!src) {
    failures.push(`missing ${page.rel}`);
    continue;
  }
  expect(/import \{ PresenterSection \} from '@\/components\/nos\/PresenterSection';/.test(src), `${page.rel} must import { PresenterSection } from '@/components/nos/PresenterSection'`);
  expect(!/void presenters;/.test(src), `${page.rel} still discards presenters with \`void presenters;\``);
  expect(new RegExp(`loadPresenterViewModels\\('${page.event}'\\)`).test(src), `${page.rel} must keep loadPresenterViewModels('${page.event}')`);
  const tag = new RegExp(`<PresenterSection eyebrow="${page.eyebrow}" presenters=\\{presenters\\} />`);
  expect(tag.test(src), `${page.rel} must render <PresenterSection eyebrow="${page.eyebrow}" presenters={presenters} />`);
  const iHero = src.indexOf('<ShowContentState');
  const iSection = src.indexOf('<PresenterSection');
  const iNav = src.indexOf('<ShowSectionNav');
  expect(iHero !== -1 && iSection > iHero && iNav > iSection, `${page.rel}: <PresenterSection> must sit after <ShowContentState> and before <ShowSectionNav>`);
}

const showDir = 'app/(marketing)/national-show';
const presenterRoutes = readdirSync(repoPath(showDir)).filter(
  (name) => /presenter|speaker/i.test(name) && statSync(repoPath(`${showDir}/${name}`)).isDirectory(),
);
expect(presenterRoutes.length === 0, `no new presenter/speaker route allowed under ${showDir}, found: ${presenterRoutes.join(', ')}`);
expect(existsSync(repoPath(`${showDir}/presenters.css`)), `${showDir}/presenters.css must exist`);

const layout = readRepoFile(`${showDir}/layout.tsx`) ?? '';
expect(/import '\.\/nos-theme\.css';\s*import '\.\/presenters\.css';/.test(layout), `${showDir}/layout.tsx must import './presenters.css' directly after './nos-theme.css'`);
const fraunces = layout.match(/const fraunces = Fraunces\(\{([\s\S]*?)\}\);/)?.[1] ?? '';
expect(/axes:\s*\['opsz'\]/.test(fraunces), "Fraunces must load the opsz axis: axes: ['opsz']");
expect(!/weight:/.test(fraunces), 'Fraunces must load as a variable font (no weight array) so 300 and 400 are both available with opsz');
expect(/variable:\s*'--font-nos-fraunces'/.test(fraunces), 'Fraunces keeps variable --font-nos-fraunces');
const karla = layout.match(/const karla = Karla\(\{([\s\S]*?)\}\);/)?.[1] ?? '';
expect(/weight:\s*\['400',\s*'500',\s*'600',\s*'700'\]/.test(karla), "Karla weights must be ['400', '500', '600', '700']");

finish('check-pages.mjs', failures, 'symposium + wosa-conference render <PresenterSection> under their heroes; layout loads presenters.css, Fraunces opsz, Karla 700.');
