// leeann-content-build F4 (FF): the unsourced stats come out, the partners stay WOSA-only, and
// South African exhibitors merges into one Exhibitors and vendors page with a permanent redirect.
// Usage: pnpm exec tsx contracts/checks/leeann-content/ff.mts <cmd>
//   stats | partners | merge-static | merge-render
import { existsSync } from 'node:fs';
import {
  NOS_HOST, SAOC_HOST, assertVerbatimInOrder, fail, finish, get, htmlToBlocks, mdToBlocks, readSource, readText,
  serve, stripWs, type Reply,
} from './lib.mts';

const cmd = process.argv[2];

const FIGURE_VALUE = /value:\s*['"](?:21|18|56|1990)['"]/;
const FIGURE_LABELS = /National Shows Hosted|Accredited Judges/;

if (cmd === 'stats') {
  // H1 (her answer: "You can leave this information out for now"). Keep 1968, the one sourced figure.
  const rules: Array<[string, RegExp[]]> = [
    ['components/home/MissionBlock.tsx', [FIGURE_VALUE, FIGURE_LABELS, /['"]21['"]|['"]18['"]|['"]56['"]/]],
    ['components/home/YearbookStrip.tsx', [/\b184\b/, /1816-0336/, /Lindiwe|Khumalo/]],
    ['components/home/NavCards.tsx', [/56 accredited judges/i]],
    ['app/(marketing)/sponsors/page.tsx', [FIGURE_VALUE, FIGURE_LABELS, /\b184\b/, /21 affiliated/i]],
    ['app/(marketing)/media-kit/page.tsx', [FIGURE_VALUE, FIGURE_LABELS]],
    ['app/(marketing)/judging/page.tsx', [FIGURE_VALUE, FIGURE_LABELS]],
  ];
  for (const [file, patterns] of rules) {
    const text = readText(file);
    for (const pattern of patterns) if (pattern.test(text)) fail(`${file}: still carries an unsourced figure (${pattern})`);
  }
  if (!/1968/.test(readText('components/home/MissionBlock.tsx'))) fail('MissionBlock keeps the founding year 1968');
  if (!/1968/.test(readText('app/(marketing)/media-kit/page.tsx'))) fail('the media kit keeps the founding year 1968');
  finish('ff stats');
} else if (cmd === 'partners') {
  // H2: SANBI and Kirstenbosch are not partners; WOSA is. The home list is already WOSA-only: keep it so.
  const text = readText('components/home/PartnersSection.tsx');
  if (/Kirstenbosch|SANBI|South African National Biodiversity/i.test(text)) fail('PartnersSection must not name SANBI or Kirstenbosch');
  if (!/Wild Orchids of Southern Africa/.test(text)) fail('PartnersSection must keep WOSA');
  finish('ff partners');
} else if (cmd === 'merge-static') {
  // V1: one page. The route, every nav entry and the routes manifest lose sa-exhibitors.
  if (existsSync('app/(nos)/national-show/sa-exhibitors/page.tsx')) fail('app/(nos)/national-show/sa-exhibitors/page.tsx must be removed');
  for (const file of ['components/nos-chrome/nos-nav.ts', 'components/show/ShowSectionNav.tsx', 'components/nos/NosShowIndex.tsx', 'content/national-show-routes.json']) {
    if (/sa-exhibitors/.test(readText(file))) fail(`${file} still lists sa-exhibitors`);
  }
  if (!/national-show\/vendors/.test(readText('content/national-show-routes.json'))) fail('the routes manifest must keep /national-show/vendors');
  if (!/sa-exhibitors/.test(readText('proxy.ts'))) fail('proxy.ts must carry the sa-exhibitors redirect');
  finish('ff merge-static');
} else if (cmd === 'merge-render') {
  const served = await serve();
  const PERMANENT = new Set([301, 308]);
  const follow = async (host: string, path: string): Promise<{ hops: number[]; final: Reply; host: string; path: string }> => {
    const hops: number[] = [];
    let at = { host, path };
    for (let i = 0; i < 4; i++) {
      const reply = await get(served.port, at.host, at.path);
      if (reply.status < 300 || reply.status >= 400) return { hops, final: reply, ...at };
      hops.push(reply.status);
      const next = new URL(reply.location ?? '/', `http://${at.host}`);
      at = { host: next.hostname, path: `${next.pathname}${next.search}` };
    }
    throw new Error(`redirect loop from ${host}${path}`);
  };
  try {
    const cases: Array<[string, string]> = [[NOS_HOST, '/sa-exhibitors'], [NOS_HOST, '/national-show/sa-exhibitors'], [SAOC_HOST, '/national-show/sa-exhibitors']];
    for (const [host, path] of cases) {
      const result = await follow(host, path);
      const label = `${host}${path}`;
      if (result.hops.length === 0) fail(`${label}: must redirect, got HTTP ${result.final.status}`);
      if (result.hops.some((status) => !PERMANENT.has(status))) fail(`${label}: every hop must be permanent (301 or 308), got ${result.hops.join(', ')}`);
      if (result.host !== NOS_HOST || result.path !== '/vendors' || result.final.status !== 200) {
        fail(`${label}: must end at ${NOS_HOST}/vendors with 200, ended at ${result.host}${result.path} (${result.final.status})`);
      }
    }
    const sitemap = await get(served.port, NOS_HOST, '/sitemap.xml');
    if (/sa-exhibitors/.test(sitemap.body)) fail('sitemap.xml still lists sa-exhibitors');

    // Her v1.1 introduction is on the merged page, word for word; the retired v1.0 wording and the
    // invited-vendor short list (Q-D6: invited is not confirmed) are not.
    const page = await get(served.port, NOS_HOST, '/vendors');
    if (page.status !== 200) fail(`${NOS_HOST}/vendors: HTTP ${page.status}`);
    const blocks = htmlToBlocks(page.body);
    const hers = mdToBlocks(readSource('exhibitors-sa'));
    const start = hers.findIndex((b) => b.startsWith('Showcasing the Finest'));
    const intro = hers.slice(start, start + 5);
    if (start === -1 || intro.length !== 5) fail('golden: her exhibitors introduction block not found');
    assertVerbatimInOrder(`${NOS_HOST}/vendors intro`, intro, blocks);
    const flat = stripWs(blocks.join(''));
    const absent = ['The 2027 South African National Orchid Show will proudly showcase', 'to complete an established collection', 'Short List of Invited Vendors', 'Ecuagenera', 'Orchidology', 'Afri-Orchids', 'Every nursery has'];
    for (const phrase of absent) if (flat.includes(stripWs(phrase))) fail(`${NOS_HOST}/vendors must not carry "${phrase}"`);
  } finally {
    served.stop();
  }
  finish('ff merge-render');
} else {
  console.error('usage: ff.mts stats|partners|merge-static|merge-render');
  process.exit(2);
}
