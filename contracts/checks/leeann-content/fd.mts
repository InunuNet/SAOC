// leeann-content-build F3 (FD): FAQ, Plan Your Visit, What to Expect, Contact and About, from Lee-Ann's
// 24 Oct 2026 documents. Nothing here reads or writes live Sanity: the FAQ is proved through its golden
// fixture, the seed script's dry run and the list component; the pages through the real rendered HTML.
// Usage: pnpm exec tsx contracts/checks/leeann-content/fd.mts <cmd>
//   faq-fixture | faq-schema | faq-sections | faq-seed | faq-list | faq-page | about | what-to-expect | plan-guide | contact
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  GOLDENS, NOS_HOST, anchorsOf, assertNoPhantoms, assertVerbatimInOrder, decodeEntities, fail, finish, get,
  htmlToBlocks, mdToBlocks, readSource, readText, serve, stripWs,
} from './lib.mts';
import { deriveFaqFixture, type FaqFixture } from './gen-faq-fixture.mts';

const cmd = process.argv[2];
const golden = JSON.parse(readFileSync(`${GOLDENS}/faq/faq-docs.json`, 'utf8')) as FaqFixture;

function portable(paragraphs: string[], key: string) {
  return paragraphs.map((text, i) => ({
    _type: 'block', _key: `${key}-b${i}`, style: 'normal', markDefs: [],
    children: [{ _type: 'span', _key: `${key}-s${i}`, text, marks: [] }],
  }));
}

function blockText(block: unknown): string {
  const children = (block as { children?: Array<{ text?: string }> }).children ?? [];
  return children.map((c) => c.text ?? '').join('');
}

async function page(path: string): Promise<{ blocks: string[]; html: string }> {
  const served = await serve();
  try {
    const reply = await get(served.port, NOS_HOST, path);
    if (reply.status !== 200) fail(`${NOS_HOST}${path}: HTTP ${reply.status}`);
    return { blocks: htmlToBlocks(reply.body), html: reply.body };
  } finally {
    served.stop();
  }
}

if (cmd === 'faq-fixture') {
  // The golden is exactly what her faq.txt yields, and the counts are what her document holds.
  if (JSON.stringify(deriveFaqFixture()) !== JSON.stringify(golden)) fail('faq-docs.json no longer equals the derivation of source/faq.txt (run gen-faq-fixture.mts)');
  if (golden.sections.length !== 12) fail(`expected 12 sections, got ${golden.sections.length}`);
  if (golden.questions.length !== 79) fail(`expected 79 questions (1-67 and 75-86), got ${golden.questions.length}`);
  if (golden.questions.some((q) => /^\d+\./.test(q.question))) fail('question text carries a leading number');
  finish('fd faq-fixture');
} else if (cmd === 'faq-schema') {
  // Schema: category list is her 12 sections, in her order, replacing the five legacy categories.
  const text = readText('sanity/schemas/documents/showFaq.ts');
  const values = [...text.matchAll(/value:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]).filter((v) => !['pending', 'research', 'confirmed'].includes(v));
  const want = golden.sections.map((s) => s.id);
  if (JSON.stringify(values) !== JSON.stringify(want)) fail(`showFaq.category list must be ${JSON.stringify(want)}, got ${JSON.stringify(values)}`);
  for (const section of golden.sections) if (!text.includes(`title: '${section.title.replace(/'/g, "\\'")}'`) && !text.includes(`title: "${section.title}"`)) fail(`showFaq.category option title missing: ${section.title}`);
  finish('fd faq-schema');
} else if (cmd === 'faq-sections') {
  // One source for the section order, titles and introductions: lib/data/faq-sections.ts. The list
  // component and the page both read it; neither keeps its own category list.
  const mod = (await import('../../../lib/data/faq-sections.ts').catch(() => null)) as { FAQ_SECTIONS?: Array<{ id: string; title: string; intro?: string[] }> } | null;
  if (!mod?.FAQ_SECTIONS) fail('lib/data/faq-sections.ts must export FAQ_SECTIONS');
  else {
    const got = mod.FAQ_SECTIONS.map((s) => ({ id: s.id, title: s.title, intro: s.intro ?? [] }));
    const want = golden.sections.map((s) => ({ id: s.id, title: s.title, intro: s.intro }));
    if (JSON.stringify(got) !== JSON.stringify(want)) fail('FAQ_SECTIONS must equal her 12 sections (id, title, intro) in her order, text verbatim');
  }
  for (const file of ['components/show/ShowFaqList.tsx', 'app/(nos)/national-show/faq/page.tsx']) {
    const src = readText(file);
    if (!src.includes('FAQ_SECTIONS')) fail(`${file} must read FAQ_SECTIONS`);
    if (/'plant-sales'|'getting-there'/.test(src)) fail(`${file} still carries the legacy category list`);
  }
  finish('fd faq-sections');
} else if (cmd === 'faq-seed') {
  // scripts/seed-show-faq.ts: dry run is the default and prints the exact documents; only --apply writes.
  // This check never passes --apply and runs with no Sanity token.
  const script = readText('scripts/seed-show-faq.ts');
  if (!script.includes('--apply')) fail('seed-show-faq.ts must write only behind --apply');
  const env = { ...process.env };
  delete env.SANITY_API_TOKEN;
  let out = '';
  try {
    out = execFileSync('pnpm', ['exec', 'tsx', 'scripts/seed-show-faq.ts'], { encoding: 'utf8', env, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    fail(`dry run failed: ${(error as Error).message.split('\n')[0]}`);
  }
  if (out) {
    let result: { mode?: string; documents?: Array<Record<string, unknown>>; delete?: string[] } = {};
    try {
      result = JSON.parse(out.slice(out.indexOf('{'))) as typeof result;
    } catch {
      fail('dry run must print one JSON object {mode, documents, delete}');
    }
    if (result.mode !== 'dry-run') fail(`mode must be "dry-run", got ${JSON.stringify(result.mode)}`);
    const docs = new Map((result.documents ?? []).map((d) => [d._id as string, d]));
    if (docs.size !== golden.questions.length) fail(`want ${golden.questions.length} documents, got ${docs.size}`);
    for (const q of golden.questions) {
      const doc = docs.get(q._id);
      if (!doc) { fail(`${q._id}: missing`); continue; }
      if (doc._type !== 'showFaq' || doc.question !== q.question || doc.category !== q.section || doc.order !== q.number || doc.status !== 'confirmed' || doc.active !== true) {
        fail(`${q._id}: _type/question/category/order/status/active do not match the golden`);
      }
      const answer = Array.isArray(doc.answer) ? (doc.answer as unknown[]).map(blockText) : [];
      if (JSON.stringify(answer) !== JSON.stringify(q.answer)) fail(`${q._id}: answer text is not her text verbatim`);
    }
    const gone = new Set(result.delete ?? []);
    for (const id of golden.legacyIds) if (!gone.has(id)) fail(`legacy document ${id} must be in the delete list`);
    if ((result.delete ?? []).some((id) => !golden.legacyIds.includes(id))) fail('delete list may contain only the 14 legacy showFaq ids');
  }
  finish('fd faq-seed');
} else if (cmd === 'faq-list') {
  // ShowFaqList, given the golden documents in a hostile order (alphabetical by category id, as the
  // query sorts), prints her sections in her order, her introductions (including the question-less
  // section 10), and every question and answer verbatim.
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ShowFaqList } = await import('../../../components/show/ShowFaqList.tsx');
  const faqs = golden.questions.map((q) => ({ _id: q._id, question: q.question, category: q.section, order: q.number, status: 'confirmed', answer: portable(q.answer, q._id) }));
  const alphabetical = [...faqs].sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : a.order - b.order));
  const html = renderToStaticMarkup(React.createElement(ShowFaqList as never, { faqs: alphabetical, hideUnanswered: false }));
  const rendered = htmlToBlocks(html);
  const expected: string[] = [];
  for (const section of golden.sections) {
    expected.push(section.title, ...section.intro);
    for (const q of golden.questions.filter((x) => x.section === section.id)) expected.push(q.question, ...q.answer);
  }
  assertVerbatimInOrder('FAQ list', expected, rendered);
  assertNoPhantoms('FAQ list', expected, rendered);
  finish('fd faq-list');
} else if (cmd === 'faq-page') {
  // Her verbatim answers are never replaced by a derived value; the one wired row (prices) follows Q10.
  const src = readText('app/(nos)/national-show/faq/page.tsx');
  if (/showFaq-getting-there-3|showFaq-tickets-1|showFaq-[a-z-]+-\d/.test(src)) fail('faq/page.tsx keys wired rows by a legacy showFaq id');
  if (/replaces:\s*true/.test(src)) fail("faq/page.tsx: no wired row may replace her answer (Q18's venue name would overwrite her text and Q-D14 is open)");
  finish('fd faq-page');
} else if (cmd === 'about') {
  const { blocks, html } = await page('/about');
  const hers = mdToBlocks(readSource('about-2027'), 'about-2027').slice(2);
  if (hers.length !== 7) fail(`golden: expected her 7 About paragraphs, got ${hers.length}`);
  assertVerbatimInOrder('/about', hers, blocks);
  const flat = stripWs(blocks.join(''));
  for (const old of ['Through presentations and collaborative sessions within the symposium', 'spectacular displays created by orchid societies', 'The 2027 South African National Orchid Show is the South African Orchid']) {
    if (flat.includes(stripWs(old))) fail(`/about still carries the retired wording "${old}"`);
  }
  const description = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(html)?.[1];
  if (!description || /2027 South African National Orchid Show/i.test(decodeEntities(description))) fail('the /about meta description must not use "2027 South African National Orchid Show"');
  finish('fd about');
} else if (cmd === 'what-to-expect') {
  const { blocks } = await page('/what-to-expect');
  const all = mdToBlocks(readSource('what-to-expect'), 'what-to-expect');
  const start = all.findIndex((b) => b.startsWith('The National Orchid Show – Western Cape 2027 promises'));
  const hers = start === -1 ? [] : all.slice(start);
  if (hers.length !== 7) fail(`golden: expected her 7 What to Expect paragraphs, got ${hers.length}`);
  assertVerbatimInOrder('/what-to-expect', hers, blocks);
  const flat = stripWs(blocks.join(''));
  for (const old of ['The 2027 South African National Orchid Show promises an immersive', 'Integrated throughout the symposium, presentations by Wild Orchids of Southern Africa', 'from the protection of orchids in the wild to the pursuit of cultivated excellence']) {
    if (flat.includes(stripWs(old))) fail(`/what-to-expect still carries the retired wording "${old}"`);
  }
  finish('fd what-to-expect');
} else if (cmd === 'plan-guide') {
  const { blocks, html } = await page('/plan-your-visit');
  const raw = readSource('plan-your-visit').split('\n');
  const first = raw.findIndex((l) => l.includes('Discover Stellenbosch, Cape Town'));
  const last = raw.findIndex((l) => l.includes('Start planning your visit today'));
  const slice = raw.slice(first, last + 1).join('\n');
  const hers = mdToBlocks(slice, 'plan-your-visit');
  if (first === -1 || last === -1 || hers.length < 100) fail('golden: her guide range not found');
  if (!/data-plan-guide/.test(html)) fail('the guide must sit in one element carrying data-plan-guide');
  const guide = htmlToBlocks(html, 'data-plan-guide');
  assertVerbatimInOrder('plan guide', hers, guide);
  assertNoPhantoms('plan guide', hers, guide);
  const anchors = anchorsOf(html, 'data-plan-guide');
  const links = [...slice.matchAll(/\[([^\]]+)\]\((https?:[^)]+)\)/g)].map((m) => ({ text: m[1].replace(/\*+/g, '').trim(), url: m[2] }));
  if (links.length < 30) fail(`golden: expected about 35 links, found ${links.length}`);
  const missing = links.filter((link) => !anchors.some((a) => a.href === link.url && stripWs(a.text) === stripWs(link.text)));
  for (const link of missing.slice(0, 5)) fail(`link missing or altered: [${link.text}](${link.url})`);
  if (missing.length > 5) fail(`...and ${missing.length - 5} more links missing or altered (of ${links.length})`);
  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) if (!/rel="[^"]*noopener/.test(m[0])) fail('an external link opens a new tab without rel="noopener"');
  const flat = stripWs(blocks.join(''));
  for (const gone of ['Be the first to know', 'Stay informed', 'Ask the council', 'Parking, public transport and accommodation are confirmed by the show committee']) {
    if (flat.includes(stripWs(gone))) fail(`/plan-your-visit must not carry the removed block "${gone}"`);
  }
  finish('fd plan-guide');
} else if (cmd === 'contact') {
  const { blocks, html } = await page('/contact');
  const flatBlocks = blocks;
  const constants = (await import('../../../lib/show-contact.ts').catch(() => null)) as { SHOW_ADDRESS_LINES?: string[] } | null;
  const address = ['Stellenbosch Airfield', 'Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, Stellenbosch, Western Cape.'];
  if (JSON.stringify(constants?.SHOW_ADDRESS_LINES) !== JSON.stringify(address)) fail('lib/show-contact.ts must export SHOW_ADDRESS_LINES = her two address lines verbatim');
  assertVerbatimInOrder('/contact', [...address, '073 428 4398', 'Lee-Ann McCleland', 'Show co-ordinator'], flatBlocks);
  const hrefs = anchorsOf(html).map((a) => a.href);
  if (!hrefs.some((h) => h === 'tel:+27734284398' || h === 'tel:0734284398')) fail('the phone number must be a tel: link');
  const flat = stripWs(flatBlocks.join(''));
  // Q-D6 default: no committee list. Q-D11 default: no email address is printed.
  for (const name of ['Hendrik Schoeman', 'Barry Deutschmann', 'Bernadette Smith', 'Otto and Nerine']) if (flat.includes(stripWs(name))) fail(`/contact must not list the committee yet ("${name}")`);
  for (const email of ['2027national@gmail.com', 'show@saoc.co.za']) if (flat.includes(stripWs(email))) fail(`/contact must not print ${email} until Q-D11 is answered`);
  finish('fd contact');
} else {
  console.error('usage: fd.mts faq-fixture|faq-schema|faq-sections|faq-seed|faq-list|faq-page|about|what-to-expect|plan-guide|contact');
  process.exit(2);
}
