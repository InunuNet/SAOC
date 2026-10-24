// nav-focus-underline HD-1 -- compares SAOC and NOS header geometry. Run: node <this file> <measurements.json> | --selftest
// Thresholds live in goldens/header-geometry.json. Exit 0 = every rule holds at every width.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const golden = JSON.parse(readFileSync(new URL('../goldens/header-geometry.json', import.meta.url), 'utf8'));
const BP = golden.breakpoints;
const WIDTHS = [...new Set([...golden.widths, BP.full - 1, BP.full, BP.row - 1, BP.row])].sort((a, b) => b - a);
const inBand = (w, when) => ({ all: true, full: w >= BP.full, menu: w >= BP.row && w < BP.full, phone: w < BP.row, wide: w >= BP.row })[when];

export function compare(m, feature = 'f2') {
  const failures = [];
  for (const w of WIDTHS) {
    const s = m.hosts?.saoc?.[w];
    const n = m.hosts?.nos?.[w];
    if (!s || !n) { failures.push(`${w}: missing measurements for ${!s ? 'saoc' : 'nos'}`); continue; }
    for (const r of golden.rules) {
      if (!inBand(w, r.when) || (r.feature ?? 'f2') !== feature) continue;
      const a = s[r.metric] ?? null;
      const b = n[r.metric] ?? null;
      const tag = `${w} ${r.id} (${r.metric}) saoc=${JSON.stringify(a)} nos=${JSON.stringify(b)}`;
      if (r.sameAsMetric) {
        for (const [host, row] of [['saoc', s], ['nos', n]]) {
          const x = row[r.metric] ?? null, y = row[r.sameAsMetric] ?? null;
          if (x === null || y === null || Math.abs(x - y) > r.tol) failures.push(`${w} ${r.id} (${r.metric} vs ${r.sameAsMetric}) ${host}: ${x} vs ${y}`);
        }
        continue;
      }
      const hosts = r.hostOnly ? [[r.hostOnly, r.hostOnly === 'saoc' ? a : b]] : [['saoc', a], ['nos', b]];
      if (!r.hostOnly && (a === null) !== (b === null)) { failures.push(`${tag}: present on one host only`); continue; }
      if (r.pair !== undefined || r.same) {
        if (r.hostOnly || a === null) continue;
        if (r.same ? String(a).toLowerCase() !== String(b).toLowerCase() : Math.abs(a - b) > r.pair) failures.push(tag);
      } else if (r.target !== undefined) {
        for (const [host, v] of hosts) {
          if (v === null) { if (r.hostOnly) failures.push(`${w} ${r.id}: ${host} does not show the element`); continue; }
          if (Math.abs(v - r.target) > r.tol) failures.push(`${tag}: ${host} outside ${r.target}+-${r.tol}`);
        }
      } else if (r.min !== undefined) {
        for (const [host, v] of hosts) {
          if (v === null) { failures.push(`${w} ${r.id}: ${host} does not show the element`); continue; }
          if (v < r.min - r.tol) failures.push(`${tag}: ${host} below ${r.min}`);
        }
      } else if ('each' in r) {
        for (const [host, v] of hosts) if (v !== r.each) failures.push(`${tag}: ${host} must be ${JSON.stringify(r.each)}`);
      }
    }
  }
  const cs = String(golden.crossSiteWidth);
  const x = m.crossSite?.[cs];
  if (feature !== 'f2') return failures;
  if (!x?.before || !x?.after) failures.push(`crossSite ${cs}: before/after measurements missing (SAOC "National Show" click-through)`);
  else for (const [k, tol] of Object.entries(golden.crossSiteTolerance)) {
    if (Math.abs(x.before[k] - x.after[k]) > tol) failures.push(`crossSite ${cs} ${k}: ${x.before[k]} -> ${x.after[k]} (header jumped, tol ${tol})`);
  }
  return failures;
}

function baseline() {
  const hosts = { saoc: {}, nos: {} };
  for (const w of WIDTHS) {
    const full = w >= BP.full, wide = w >= BP.row;
    const content = Math.min(w - 32, 1320);
    const make = () => ({
      utilityBars: 0, headerHeight: wide ? 97 : 110, headerPosition: wide ? 'sticky' : 'relative', barMaxWidth: full ? 1384 : null,
      barPaddingTop: 13, barPaddingLeft: 32, barGap: wide ? 24 : 12, brandLeft: 361, brandWidth: Math.min(content, 405), brandWidthBound: Math.min(content, 405), brandCenterOffset: 0,
      gapBrandNav: full ? 24 : null, gapNavSearch: null, gapSearchCta: null, gapNavCta: full ? 12 : null,
      barContentWidth: content, barRows: wide ? 1 : 2,
      navSingleLine: full ? true : null, itemHeightMin: full ? 44 : null, itemHeightMax: full ? 44 : null,
      itemFontSize: full ? '14.5px' : null, itemFontWeight: full ? '600' : null, itemLineHeight: full ? '14.5px' : null,
      itemLetterSpacing: full ? 'normal' : null, itemTextTransform: full ? 'none' : null, itemPaddingLeft: full ? 9 : null, itemGap: full ? 2 : null,
      ctaHeight: 44, ctaRight: 1700, ctaRightInset: 0, ctaPaddingTop: 10, ctaPaddingLeft: 24, ctaRadius: '10px', ctaFontSize: '13px',
      ctaFontWeight: '700', ctaLineHeight: '13px', ctaLetterSpacing: '1.56px', ctaTextTransform: 'uppercase',
      searchWidth: null, searchHeight: null, menuHeight: full ? null : 44, menuText: full ? null : 'menu',
      activeBarBottom: full ? '-8px' : null, activeBarHeight: full ? '2px' : null, mainGap: 0, overflowX: 0, contentLeft: 361,
    });
    hosts.saoc[w] = make();
    hosts.nos[w] = make();
    if (full) { hosts.saoc[w].searchWidth = 44; hosts.saoc[w].searchHeight = 44; Object.assign(hosts.saoc[w], { gapNavSearch: 12, gapSearchCta: 12, gapNavCta: null }); }
  }
  return { hosts, crossSite: { [golden.crossSiteWidth]: { before: { headerHeight: 97, brandLeft: 361, brandTop: 13 }, after: { headerHeight: 97, brandLeft: 361, brandTop: 13 } } } };
}

function selftest() {
  const f3 = (name, mutate, ruleId) => {
    const m = baseline();
    mutate(m);
    const f = compare(m, 'f3');
    if (ruleId === null ? f.length : !f.some((x) => x.includes(ruleId))) bad.push(`${name}: expected ${ruleId === null ? 'pass' : `failure on ${ruleId}`}, got ${JSON.stringify(f.slice(0, 3))}`);
  };
  const bad = [];
  const expect = (name, mutate, ruleId) => {
    const m = baseline();
    mutate(m);
    const f = compare(m);
    if (ruleId === null ? f.length : !f.some((x) => x.includes(ruleId))) bad.push(`${name}: expected ${ruleId === null ? 'pass' : `failure on ${ruleId}`}, got ${JSON.stringify(f.slice(0, 3))}`);
  };
  f3('f3 aligned edges pass', () => {}, null);
  f3('f3 SAOC content still at the 1216 box', (m) => { m.hosts.saoc[1440].contentLeft = 393; }, 'content-left-edge');
  f3('f3 h1 off the lockup edge', (m) => { m.hosts.nos[2056].contentLeft = 380; }, 'h1-aligned-with-lockup');
  expect('identical headers pass', () => {}, null);
  expect('SAOC utility bar still there', (m) => { m.hosts.saoc[2056].utilityBars = 1; }, 'no-utility-bar');
  expect('SAOC header 74 tall', (m) => { m.hosts.saoc[1440].headerHeight = 74; }, 'header-height-pair');
  expect('SAOC header 80 at BP-ROW', (m) => { m.hosts.saoc[BP.row].headerHeight = 80; }, 'header-height-pair');
  expect('CTA right edge off by 5', (m) => { m.hosts.saoc[1280].ctaRight = 1695; }, 'cta-right-edge');
  expect('nav item 24 tall', (m) => { m.hosts.saoc[1440].itemHeightMin = 24; }, 'item-height-44');
  expect('lockup ink 380 wide', (m) => { m.hosts.saoc[2056].brandWidth = 380; }, 'brand-ink-width-pair');
  expect('lockup not centred', (m) => { m.hosts.saoc[1440].brandCenterOffset = 8; }, 'brand-centred-in-bar');
  expect('lockup short of the phone row', (m) => { m.hosts.saoc[390].brandWidth = 300; }, 'brand-width-capped');
  expect('lockup grows past 405 at 760', (m) => { m.hosts.nos[760].brandWidth = 728; }, 'brand-width-capped');
  expect('header heights differ at 760', (m) => { m.hosts.saoc[760].headerHeight = 130; }, 'header-height-pair');
  expect('brand-nav gap 16', (m) => { m.hosts.saoc[1440].gapBrandNav = 16; }, 'gap-brand-nav-min-24');
  expect('nav-search gap 24', (m) => { m.hosts.saoc[1440].gapNavSearch = 24; }, 'gap-nav-search-12');
  expect('search-cta gap 24', (m) => { m.hosts.saoc[2056].gapSearchCta = 24; }, 'gap-search-cta-12');
  expect('NOS nav-cta gap 24', (m) => { m.hosts.nos[1440].gapNavCta = 24; }, 'gap-nav-cta-12-nos');
  expect('bar wraps at BP-FULL', (m) => { m.hosts.saoc[BP.full].barRows = 2; }, 'bar-single-row');
  expect('bar wraps at BP-ROW', (m) => { m.hosts.nos[BP.row].barRows = 2; }, 'bar-single-row-menu');
  expect('phone band header 15px taller fails (parity holds at 390)', (m) => { m.hosts.saoc[390].headerHeight = 125; }, 'header-height-pair');
  expect('search 34 wide', (m) => { m.hosts.saoc[2056].searchWidth = 34; }, 'search-width-44');
  expect('search missing on SAOC', (m) => { m.hosts.saoc[2056].searchWidth = null; }, 'search-width-44');
  expect('menu button icon-only', (m) => { m.hosts.saoc[390].menuText = ''; }, 'menu-label');
  expect('active bar at -4px', (m) => { m.hosts.saoc[2056].activeBarBottom = '-4px'; }, 'active-bar-offset');
  expect('nav wraps to two lines', (m) => { m.hosts.saoc[1440].navSingleLine = false; }, 'nav-single-line');
  expect('page overflows sideways', (m) => { m.hosts.saoc[1024].overflowX = 12; }, 'no-horizontal-overflow');
  expect('element on one host only', (m) => { m.hosts.nos[1024].menuHeight = null; }, 'menu-height');
  expect('header jumps on cross-site click', (m) => { m.crossSite['1440'].after.headerHeight = 74; }, 'headerHeight');
  expect('missing width', (m) => { delete m.hosts.nos[390]; }, '390:');
  expect('missing derived width', (m) => { delete m.hosts.saoc[BP.row - 1]; }, `${BP.row - 1}:`);
  if (bad.length) { console.error('SELFTEST FAIL\n- ' + bad.join('\n- ')); process.exit(1); }
  console.log(`compare-geometry selftest pass (${golden.rules.length} rules, ${WIDTHS.length} widths)`);
}

const arg = process.argv[2];
if (arg === '--selftest') selftest();
else if (arg) {
  const fi = process.argv.indexOf('--feature');
  const feature = fi === -1 ? 'f2' : process.argv[fi + 1];
  const m = JSON.parse(readFileSync(arg, 'utf8'));
  const failures = compare(m, feature);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (m.commitSha !== head) failures.push(`commitSha ${m.commitSha} is not HEAD ${head} (measurements must be taken on the deployed commit)`);
  if (!m.routes?.saoc || !m.routes?.nos) failures.push('routes.saoc and routes.nos must name the pages measured (a page whose h1 is left-aligned, with a current nav item)');
  if (failures.length) { console.error(`FAIL\n- ${failures.join('\n- ')}`); process.exit(1); }
  console.log(`header geometry parity holds (${feature})`);
} else { console.error('usage: compare-geometry.mjs <measurements.json> [--feature f2|f3] | --selftest'); process.exit(2); }
