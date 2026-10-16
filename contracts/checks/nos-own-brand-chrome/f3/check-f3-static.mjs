// F3 static guards (no browser):  node contracts/checks/nos-own-brand-chrome/f3/check-f3-static.mjs <og-source|announced-soon|photo-map|ozow-banner|no-section-nav|sales-gate>
//  og-source      : the NOS og generator (the one file under app/(marketing)/national-show that uses ImageResponse) draws the card from the NOS
//                   assets: royal #211A57 ground, the reversed NOS horizontal lockup, "saoc.co.za/national-show", Fraunces at weight 300 for the title and
//                   Karla at 12px for the url; no SAOC logo, no green, no gradient. Pixel facts are measured by F3-J3; fonts are only provable here.
//  announced-soon : no NOS-rendered source says "announced soon" and the vendors page no longer renders the SAOC VendorEmptyState that does.
//  ozow-banner    : the Ozow TEST MODE banner is gated on payment mode only (status API), never on NODE_ENV or hostname (the runtime proof is check-f3-tickets.mjs, which mocks the status route).
//  photo-map      : goldens/f3/hero-photo-map.json is well formed: 5 routes, 5 distinct existing files, each one of the five rights-cleared photographs.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const F3_GOLDEN_DIR = '.agent/memory/project/specs/nos-own-brand-chrome/goldens/f3';

const fails = [];
const need = (ok, msg) => { if (!ok) fails.push(msg); };
const NOS_APP = 'app/(marketing)/national-show';
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\w])\/\/.*$/gm, '$1');
const FIVE = ['orchid-dark', 'orchid-pink', 'orchid-purple', 'orchid-violet', 'orchid-yellow'].map((n) => `/images/${n}.jpg`);

const modes = {
  'og-source'() {
    const files = walk(NOS_APP).filter((f) => /\.(tsx?|jsx?)$/.test(f)).filter((f) => /ImageResponse/.test(readFileSync(f, 'utf8')));
    need(files.length >= 1, `no file under ${NOS_APP} uses ImageResponse (the NOS og card generator)`);
    for (const f of files) {
      const raw = readFileSync(f, 'utf8');
      const text = strip(raw);
      need(/#211a57/i.test(text), `${f}: no royal #211A57 ground`);
      need(/nos-reversed-horizontal-1200/.test(text), `${f}: does not use the reversed NOS horizontal lockup (nos-reversed-horizontal-1200.png)`);
      need(/saoc\.co\.za\/national-show/.test(text), `${f}: no "saoc.co.za/national-show" line`);
      need(/fraunces/i.test(text) && /\b300\b/.test(text), `${f}: title is not Fraunces at weight 300`);
      need(/karla/i.test(text) && /\b12\b/.test(text), `${f}: url line is not Karla at 12px`);
      const bad = /saoc-lockup|saoc-emblem|saoc-logo|eulophia|#4a7c59|#1a2e1e|#0f1a11|#6b8f75|linear-gradient|georgia/i.exec(text);
      need(!bad, `${f}: references "${bad?.[0]}" (never the SAOC logo, never green, no gradient, no Georgia)`);
    }
  },
  'announced-soon'() {
    const roots = [NOS_APP, 'components/nos', 'components/show'];
    for (const root of roots) for (const f of walk(root).filter((x) => /\.(tsx?|css)$/.test(x))) {
      need(!/announced soon/i.test(strip(readFileSync(f, 'utf8'))), `${f}: still says "announced soon"`);
    }
    const page = readFileSync(`${NOS_APP}/vendors/page.tsx`, 'utf8');
    need(!/VendorEmptyState/.test(strip(page)), `${NOS_APP}/vendors/page.tsx: still renders the SAOC VendorEmptyState ("Nurseries will be announced soon")`);
  },
  'ozow-banner'() {
    const f = 'components/tickets/OzowSandboxTestModeBanner.tsx';
    const t = strip(readFileSync(f, 'utf8'));
    need(!/NODE_ENV|hostname|location\.host|window\.location|VERCEL|APP_ENV/.test(t), `${f}: the banner must not be gated on NODE_ENV or hostname; payment mode (the status API) is the only gate`);
    need(/ozow-sandbox-test-mode/.test(t), `${f}: the banner is not driven by /api/tickets/ozow-sandbox-test-mode`);
    need(/enabled\s*===\s*true/.test(t), `${f}: the banner must render only when the status API reports enabled === true (fail closed)`);
  },
  'no-section-nav'() {
    for (const f of walk(NOS_APP).filter((x) => /\.(tsx?|css)$/.test(x))) need(!/ShowSectionNav/.test(strip(readFileSync(f, 'utf8'))), `${f}: still references ShowSectionNav (removed from every NOS route)`);
  },
  'sales-gate'() {
    const form = readFileSync('components/tickets/TicketPurchaseForm.tsx', 'utf8');
    need(/OzowSandboxTestModeBanner/.test(strip(form)), 'components/tickets/TicketPurchaseForm.tsx: the banner must live inside the purchase form (so closed sales render no banner)');
    for (const f of [`${NOS_APP}/tickets/page.tsx`, 'components/tickets/CategoryTicketsPage.tsx', 'app/(marketing)/tickets/page.tsx']) {
      const t = strip(readFileSync(f, 'utf8'));
      need(/salesOpen\s*===\s*true/.test(t), `${f}: salesOpen is not read fail-closed (=== true)`);
    }
    for (const f of ['components/tickets/CategoryTicketsPage.tsx', 'app/(marketing)/tickets/page.tsx']) {
      const t = strip(readFileSync(f, 'utf8'));
      need(/!salesOpen[\s\S]{0,200}SalesClosedNotice/.test(t), `${f}: the !salesOpen branch must render SalesClosedNotice before any form or price`);
    }
  },
  'photo-map'() {
    const map = JSON.parse(readFileSync(`${F3_GOLDEN_DIR}/hero-photo-map.json`, 'utf8')).routes;
    const entries = Object.entries(map);
    need(entries.length === 5, `hero-photo-map.json has ${entries.length} routes, want 5`);
    need(new Set(Object.values(map)).size === entries.length, 'hero-photo-map.json reuses a photo');
    for (const [route, src] of entries) {
      need(FIVE.includes(src), `${route}: ${src} is not one of the five rights-cleared photographs`);
      need(existsSync(`public${src}`), `${route}: public${src} does not exist`);
    }
  },
};

const mode = process.argv[2];
if (!modes[mode]) { console.error(`usage: check-f3-static.mjs <${Object.keys(modes).join('|')}>`); process.exit(2); }
modes[mode]();
if (fails.length) {
  console.error(`FAIL F3 static ${mode}: ${fails.length} problem(s)`);
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS F3 static ${mode}`);
