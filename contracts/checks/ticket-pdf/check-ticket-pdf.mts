// ticket-pdf contract checks. Usage: pnpm exec tsx contracts/checks/ticket-pdf/check-ticket-pdf.mts <cmd>
//   render | lines | longname | schedule | a4 | pages | size | text | fonts | qr | colours | copy | access | route | email | assets | trace | deps | review-order
// Every command exits 0 on pass, 1 on fail (printing each failure), 2 on an unknown command or missing tool.
// Needs poppler (pdftoppm, pdftotext, pdffonts) on PATH for the raster/text/font checks.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

const SANDBOX = '.tmp/sandbox/ticket-pdf';
const GOLDENS = '.agent/memory/project/specs/ticket-pdf/goldens';
const FIXTURE_PATH = `${GOLDENS}/fixture-order.json`;
const ALLOWED_PATH = `${GOLDENS}/copy-baseline/allowed-strings.txt`;
const A4_PT = { w: 595.28, h: 841.89 };
const A4_TOLERANCE_PT = 0.6;
const RASTER_DPI = 150;
const COLOUR_TOLERANCE = 4;
const MAX_PDF_BYTES = 2_000_000;

const fails: string[] = [];
const fail = (m: string) => fails.push(m);

type Fixture = { orderReference: string; positions: Array<Record<string, unknown> & { bookingRef: string; attendeeName: string }>; visit: Record<string, unknown> };
const fixture: Fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

function fixtureWith(n: number): Fixture {
  const positions = [...fixture.positions];
  while (positions.length < n) {
    const i = positions.length;
    positions.push({ ...fixture.positions[0], bookingRef: `SAOC-2027-ZZ${String(i).padStart(2, '0')}WQ2MZ8LA` });
  }
  return { ...fixture, positions: positions.slice(0, n) };
}

async function buildPdf(input: Fixture): Promise<Uint8Array> {
  const { buildTicketPdf } = await import('../../../lib/ticket-pdf.ts');
  return buildTicketPdf(input as never);
}

function tool(bin: string, args: string[]): string {
  try {
    return execFileSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') { console.error(`missing tool: ${bin} (install poppler)`); process.exit(2); }
    throw e;
  }
}

async function ensureFixturePdf(): Promise<string> {
  mkdirSync(SANDBOX, { recursive: true });
  const p = path.join(SANDBOX, 'fixture.pdf');
  if (!existsSync(p)) writeFileSync(p, await buildPdf(fixture));
  return p;
}

function rasterise(pdf: string, page: number, name: string): string {
  const prefix = path.join(SANDBOX, name);
  tool('pdftoppm', ['-r', String(RASTER_DPI), '-png', '-f', String(page), '-l', String(page), '-singlefile', pdf, prefix]);
  return `${prefix}.png`;
}

const cmd = process.argv[2];

if (cmd === 'render') {
  mkdirSync(SANDBOX, { recursive: true });
  const p = path.join(SANDBOX, 'fixture.pdf');
  writeFileSync(p, await buildPdf(fixture));
  for (let i = 1; i <= fixture.positions.length; i++) {
    const out = rasterise(p, i, `page-${i}`);
    if (!existsSync(out)) fail(`missing raster ${out}`);
  }
} else if (cmd === 'a4') {
  const doc = await PDFDocument.load(await buildPdf(fixture));
  doc.getPages().forEach((pg, i) => {
    const { width, height } = pg.getSize();
    if (Math.abs(width - A4_PT.w) > A4_TOLERANCE_PT || Math.abs(height - A4_PT.h) > A4_TOLERANCE_PT) fail(`page ${i + 1} is ${width}x${height}pt, want A4 ${A4_PT.w}x${A4_PT.h}`);
  });
} else if (cmd === 'pages') {
  for (const n of [1, 2, 3]) {
    const doc = await PDFDocument.load(await buildPdf(fixtureWith(n)));
    if (doc.getPageCount() !== n) fail(`${n} positions gave ${doc.getPageCount()} pages`);
  }
} else if (cmd === 'size') {
  const bytes = (await buildPdf(fixtureWith(3))).length;
  if (bytes > MAX_PDF_BYTES) fail(`3-page PDF is ${bytes} bytes (> ${MAX_PDF_BYTES}): logos/fonts not downsized or subset`);
} else if (cmd === 'text') {
  const pdf = await ensureFixturePdf();
  const all = tool('pdftotext', ['-raw', pdf, '-']);
  if (!all.includes(fixture.orderReference)) fail(`order reference ${fixture.orderReference} not extractable`);
  fixture.positions.forEach((pos, i) => {
    const page = tool('pdftotext', ['-raw', '-f', String(i + 1), '-l', String(i + 1), pdf, '-']);
    if (!page.includes(pos.attendeeName)) fail(`page ${i + 1}: attendee name not extractable`);
    if (!page.includes(pos.bookingRef)) fail(`page ${i + 1}: own booking ref not extractable`);
    fixture.positions.forEach((other, j) => {
      if (j !== i && page.includes(other.bookingRef)) fail(`page ${i + 1} contains page ${j + 1}'s booking ref`);
    });
  });
} else if (cmd === 'fonts') {
  const pdf = await ensureFixturePdf();
  const rows = tool('pdffonts', [pdf]).split('\n').slice(2).filter((l) => l.trim());
  if (rows.length === 0) fail('no fonts listed');
  const names: string[] = [];
  for (const row of rows) {
    const m = row.match(/^(\S+)\s.*\s(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$/);
    if (!m) { fail(`unparseable pdffonts row: ${row}`); continue; }
    names.push(m[1]);
    if (m[2] !== 'yes') fail(`font not embedded: ${m[1]}`);
  }
  for (const fam of ['Fraunces', 'Karla']) if (!names.some((n) => n.toLowerCase().includes(fam.toLowerCase()))) fail(`no embedded ${fam} font (found: ${names.join(', ')})`);
} else if (cmd === 'qr') {
  const pdf = await ensureFixturePdf();
  for (let i = 0; i < fixture.positions.length; i++) {
    const png = PNG.sync.read(readFileSync(rasterise(pdf, i + 1, `qr-page-${i + 1}`)));
    const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    if (!res) fail(`page ${i + 1}: QR did not decode at ${RASTER_DPI} dpi`);
    else if (res.data !== fixture.positions[i].bookingRef) fail(`page ${i + 1}: QR decoded "${res.data}", want "${fixture.positions[i].bookingRef}"`);
  }
} else if (cmd === 'colours') {
  const pdf = await ensureFixturePdf();
  const png = PNG.sync.read(readFileSync(rasterise(pdf, 1, 'colours-page-1')));
  const points: Array<[number, number, string]> = [[5, 5, '#211a57'], [5, 292, '#fbfaf0'], [5, 100, '#fbfaf0'], [20, 45, '#f3f2d6'], [190, 48, '#ffffff']];
  for (const [xmm, ymm, hex] of points) {
    const x = Math.round((xmm * RASTER_DPI) / 25.4), y = Math.round((ymm * RASTER_DPI) / 25.4);
    const o = (y * png.width + x) * 4;
    const got = [png.data[o], png.data[o + 1], png.data[o + 2]];
    const want = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    if (got.some((g, k) => Math.abs(g - want[k]) > COLOUR_TOLERANCE)) fail(`(${xmm},${ymm})mm is rgb(${got}), want ${hex}`);
  }
} else if (cmd === 'copy') {
  const pdf = await ensureFixturePdf();
  let text = tool('pdftotext', ['-raw', pdf, '-']).toLowerCase().replace(/\s+/g, ' ');
  const allowedWords = new Set<string>();
  const words = (s: string) => s.toLowerCase().split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
  for (const line of readFileSync(ALLOWED_PATH, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (line.startsWith('re:')) text = text.replace(new RegExp(line.slice(3), 'gi'), ' ');
    else words(line).forEach((w) => allowedWords.add(w));
  }
  const strings: string[] = [];
  (function walk(v: unknown) { if (typeof v === 'string') strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); })(fixture);
  strings.forEach((s) => words(s).forEach((w) => allowedWords.add(w)));
  const stray = [...new Set(words(text).filter((w) => !allowedWords.has(w)))];
  if (stray.length) fail(`words not in the copy baseline or fixture: ${stray.join(' | ')}`);
} else if (cmd === 'lines') {
  const pdf = await ensureFixturePdf();
  const norm = (t: string) => t.replace(/\s+/g, ' ');
  const want = ['In an emergency: 10111 Police (national) · 10177 Ambulance and fire (national) · 112 All emergencies, from a mobile phone', 'South African Orchid Council — saoc.co.za', 'REG# 1978/004040/08 · NPO 043-901'];
  for (let i = 0; i < fixture.positions.length; i++) {
    const page = norm(tool('pdftotext', ['-raw', '-f', String(i + 1), '-l', String(i + 1), pdf, '-']));
    for (const w of want) if (!page.includes(w)) fail(`page ${i + 1}: missing exact line "${w}"`);
    if (!page.includes('Present this ticket at the door for check in.')) fail(`page ${i + 1}: instruction line not exact`);
    if (page.includes('check-in') || page.includes('or just the booking reference')) fail(`page ${i + 1}: old instruction wording present`);
    if (!new RegExp(`PAGE ${i + 1} OF ${fixture.positions.length}`, 'i').test(page)) fail(`page ${i + 1}: PAGE n OF N missing`);
    if (/organiser/i.test(page)) fail(`page ${i + 1}: Organiser line must not appear (dropped by Codi)`);
    if (/fold here/i.test(page)) fail(`page ${i + 1}: Fold here must not appear`);
  }
} else if (cmd === 'schedule') {
  const { resolveTicketSchedule } = await import('../../../lib/ticket-pdf-schedule.ts');
  const { TICKET_PRODUCTS, productIdForSlug } = await import('../../../lib/data/ticket-presentation.ts');
  type R = { kind: string; dateText: string | null; metaText: string | null };
  const run = (slug: string, rds: boolean | null, day: string | null) => resolveTicketSchedule({ slug, requiresDaySelection: rds } as never, day) as R;
  for (const slug of ['vip', 'sunset-cocktails-single', 'weekend-pass', 'weekend-pass-early-bird']) {
    const id = productIdForSlug(slug);
    const p = id ? TICKET_PRODUCTS[id] : null;
    const r = run(slug, false, null);
    if (!p || r.kind !== 'product' || r.dateText !== p.when || r.metaText !== p.meta) fail(`${slug}: want the product's own when/meta ("${p?.when}" / "${p?.meta}"), got ${JSON.stringify(r)}`);
  }
  if (/2[456]/.test(JSON.stringify(run('vip', false, null)))) fail('vip must not carry 24/25/26');
  for (const [slug, day] of [['day-visitor', '2027-09-24'], ['early-bird', '2027-09-25']] as const) {
    const r = run(slug, true, day);
    if (r.kind !== 'chosen-day' || !(r.dateText && /\b2[45]\b/.test(r.dateText))) fail(`${slug}: chosen day not used (${JSON.stringify(r)})`);
    const none = run(slug, true, null);
    if (none.kind !== 'unconfirmed' || none.dateText !== null) fail(`${slug} without chosenDay must be the pill, got ${JSON.stringify(none)}`);
  }
  for (const slug of ['saoc-symposium', 'wosa-conference', 'workshops', 'field-trip', 'qa-fixture-ticket', 'no-such-slug']) {
    const r = run(slug, false, null);
    if (r.kind !== 'unconfirmed' || r.dateText !== null || r.metaText !== null) fail(`${slug}: must be the pill with no date, got ${JSON.stringify(r)}`);
  }
  const pdf = await ensureFixturePdf();
  const stubWords = (page: number) => {
    const html = tool('pdftotext', ['-bbox', '-f', String(page), '-l', String(page), pdf, '-']);
    const cardBottomPt = (143.9 * 72) / 25.4, stubRightPt = (108.3 * 72) / 25.4;
    return [...html.matchAll(/<word xMin="([\d.]+)" yMin="[\d.]+" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].filter((m) => Number(m[3]) < cardBottomPt && Number(m[2]) < stubRightPt).map((m) => m[4].toLowerCase());
  };
  const pageOf = (slug: string) => fixture.positions.findIndex((p) => (p as { slug?: string }).slug === slug) + 1;
  const need = (label: string, words: string[], have: string[]) => { for (const w of words) if (!have.includes(w.toLowerCase())) fail(`${label}: stub lacks "${w}"`); };
  const forbid = (label: string, words: string[], have: string[]) => { for (const w of words) if (have.includes(w.toLowerCase())) fail(`${label}: stub must not contain "${w}"`); };
  const pages = { vip: pageOf('vip'), sunset: pageOf('sunset-cocktails-single'), weekend: pageOf('weekend-pass'), symposium: pageOf('saoc-symposium') };
  if (Object.values(pages).some((n) => n < 1)) fail('fixture lacks vip / sunset / weekend / symposium positions');
  else {
    const vip = stubWords(pages.vip), sunset = stubWords(pages.sunset), weekend = stubWords(pages.weekend), sym = stubWords(pages.symposium);
    need('VIP', ['Thursday', '23', 'September', '16h00', '19h00'], vip); forbid('VIP', ['24', '25', '26', 'confirmed'], vip);
    need('Sunset', ['Thursday', '23', 'September', '18h00', '21h00'], sunset); forbid('Sunset', ['confirmed'], sunset);
    need('Weekend', ['Friday', '24', 'Sunday', '26', 'September', 'Entry', 'three'], weekend); forbid('Weekend', ['Thursday', 'confirmed'], weekend);
    need('Symposium', ['confirmed'], sym); forbid('Symposium', ['september', '2027', 'thursday'], sym);
  }
} else if (cmd === 'longname') {
  // A very long attendee name must wrap/shrink inside the stub: every word stays present and ends left of the QR tile (x = 108.3 mm).
  const name = 'Bongani Sibusiso Maximilian Oppenheimer-Vanderbijlpark Mokoena-Thandiwe Nkosazana III';
  const input = { ...fixtureWith(1), positions: [{ ...fixture.positions[0], attendeeName: name }] };
  mkdirSync(SANDBOX, { recursive: true });
  const p = path.join(SANDBOX, 'longname.pdf');
  writeFileSync(p, await buildPdf(input));
  const html = tool('pdftotext', ['-bbox', '-f', '1', '-l', '1', p, '-']);
  const boxes = [...html.matchAll(/<word xMin="([\d.]+)" yMin="[\d.]+" xMax="([\d.]+)" yMax="[\d.]+">([^<]*)<\/word>/g)].map((m) => ({ xMax: Number(m[2]), w: m[3] }));
  const limitPt = (108.3 * 72) / 25.4 - 2;
  for (const token of name.split(' ')) {
    const hit = boxes.find((b) => b.w === token);
    if (!hit) fail(`long name: word "${token}" missing or truncated`);
    else if (hit.xMax > limitPt) fail(`long name: word "${token}" ends at ${hit.xMax.toFixed(1)}pt, overlapping the QR tile (limit ${limitPt.toFixed(1)}pt)`);
  }
} else if (cmd === 'access') {
  const { authoriseTicketPdfRequest } = await import('../../../lib/ticket-pdf-access.ts');
  const mk = (bookingRef: string) => ({ bookingRef, attendeeName: 'X', ticketType: 'VIP Opening', amount: 1, qrDataUri: 'data:' });
  const orders: Record<string, ReturnType<typeof mk>[]> = {
    'SAOC-2027-ORDERAAAAAAA': [mk('SAOC-2027-AAAAAAAAAAA1'), mk('SAOC-2027-AAAAAAAAAAA2')],
    'SAOC-2027-ORDERBBBBBBB': [mk('SAOC-2027-BBBBBBBBBBB1')],
  };
  const deps = { getConfirmedOrder: async (ref: string) => (orders[ref] ? { reference: ref, positions: orders[ref] } : null) };
  const run = (ref: string | null, position: string | null) => authoriseTicketPdfRequest({ ref, position }, deps as never) as Promise<{ ok: boolean; status?: number; positions?: Array<{ bookingRef: string }> }>;
  const denied: Array<[string, string | null, string | null]> = [
    ['no ref', null, null], ['empty ref', '', null], ['blank ref', '   ', null], ['unknown ref', 'SAOC-2027-NOSUCHORDER', null],
    ['door code used as ref', 'SAOC-2027-AAAAAAAAAAA1', null],
    ['other order position', 'SAOC-2027-ORDERAAAAAAA', 'SAOC-2027-BBBBBBBBBBB1'], ['nonsense position', 'SAOC-2027-ORDERAAAAAAA', 'nonsense'],
  ];
  const bodies = new Set<string>();
  for (const [label, ref, pos] of denied) {
    const r = await run(ref, pos);
    if (r.ok !== false || r.status !== 404) fail(`${label}: want {ok:false,status:404}, got ${JSON.stringify(r)}`);
    bodies.add(JSON.stringify(r));
  }
  if (bodies.size > 1) fail('denials are distinguishable (oracle): every failure must return an identical result');
  const all = await run('SAOC-2027-ORDERAAAAAAA', null);
  if (!all.ok || all.positions?.length !== 2) fail('valid ref should yield both positions of that order');
  const one = await run('SAOC-2027-ORDERAAAAAAA', 'SAOC-2027-AAAAAAAAAAA2');
  if (!one.ok || one.positions?.length !== 1 || one.positions[0].bookingRef !== 'SAOC-2027-AAAAAAAAAAA2') fail('valid position should yield exactly that position');
} else if (cmd === 'route') {
  const src = readFileSync('app/api/tickets/pdf/route.ts', 'utf8');
  for (const needle of ['authoriseTicketPdfRequest', 'application/pdf', 'no-store', 'attachment']) if (!src.includes(needle)) fail(`route.ts lacks ${needle}`);
  const exports = src.split('\n').filter((l) => /^export\s/.test(l));
  if (!exports.some((l) => /export\s+async\s+function\s+GET\b/.test(l))) fail('route.ts does not export async function GET');
  for (const l of exports) if (!/function\s+GET\b|const\s+(dynamic|runtime)\b/.test(l)) fail(`route.ts has a disallowed export (Next route rule): ${l}`);
  if (/\.(searchParams\.get\(['"]position['"]\))/.test(src) === false) fail('route.ts does not read the position parameter');
} else if (cmd === 'email') {
  const { sendConfirmationEmail } = await import('../../../lib/confirmation-email.ts');
  const refs = ['SAOC-2027-RF82DCQDZ61R', 'SAOC-2027-K4T9WQ2MZ8LA'];
  const input = {
    orderId: 'order-fixture', buyerEmail: 'buyer@example.invalid', buyerName: 'Fixture Buyer', recoveryToken: null,
    orderReference: fixture.orderReference,
    positions: refs.map((bookingRef) => ({ bookingRef, attendeeName: 'Thandiwe Mokoena', ticketType: 'VIP Opening' })),
  };
  const qr = async () => Buffer.from('89504e470d0a1a0a', 'hex');
  type Sent = { attachments?: Array<{ contentType: string; filename: string; content: Buffer }> };
  const attempt = async (buildTicketPdf: (i: unknown) => Promise<Uint8Array>) => {
    const sent: Sent[] = [];
    const errors: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => { errors.push(a.map(String).join(' ')); };
    try {
      await sendConfirmationEmail(input as never, { mailer: { send: async (a) => { sent.push(a as Sent); } }, generateQrPngBuffer: qr, siteUrl: 'https://example.invalid', buildTicketPdf } as never);
    } catch (e) { fail(`sendConfirmationEmail threw: ${String(e)}`); } finally { console.error = orig; }
    return { sent, errors };
  };
  const ok = await attempt(async () => Buffer.from('%PDF-1.7 fixture'));
  const pdfs = (ok.sent[0]?.attachments ?? []).filter((a) => a.contentType === 'application/pdf');
  const pngs = (ok.sent[0]?.attachments ?? []).filter((a) => a.contentType === 'image/png');
  if (ok.sent.length !== 1) fail(`success path sent ${ok.sent.length} emails`);
  if (pdfs.length !== 1) fail(`success path attached ${pdfs.length} PDFs, want 1`);
  else {
    if (!/^saoc-ticket-[A-Za-z0-9-]+\.pdf$/.test(pdfs[0].filename)) fail(`odd PDF filename ${pdfs[0].filename}`);
    if (pdfs[0].content.subarray(0, 5).toString() !== '%PDF-') fail('PDF attachment content is not a PDF buffer');
  }
  if (pngs.length !== refs.length) fail(`inline QR attachments changed: ${pngs.length}`);
  for (const [label, builder] of [['sync throw', () => { throw new Error('boom-sync'); }], ['async reject', () => Promise.reject(new Error('boom-async'))]] as const) {
    const r = await attempt(builder as never);
    if (r.sent.length !== 1) fail(`${label}: email not sent exactly once (${r.sent.length})`);
    const atts = r.sent[0]?.attachments ?? [];
    if (atts.some((a) => a.contentType === 'application/pdf')) fail(`${label}: PDF attached despite failure`);
    if (atts.filter((a) => a.contentType === 'image/png').length !== refs.length) fail(`${label}: QR attachments lost`);
    if (r.errors.length === 0) fail(`${label}: failure not logged via console.error`);
    if (r.errors.some((e) => refs.some((ref) => e.includes(ref)))) fail(`${label}: log line contains a full booking ref`);
  }
  try { await sendConfirmationEmail({ ...input, positions: [] } as never, { mailer: { send: async () => {} } } as never); fail('empty positions no longer rejects'); } catch { /* expected */ }
} else if (cmd === 'assets') {
  const dir = 'lib/ticket-pdf-assets';
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const ttf = files.filter((f) => /\.(ttf|otf|woff)$/.test(f));
  for (const fam of ['Fraunces', 'Karla']) if (!ttf.some((f) => f.includes(fam))) fail(`no ${fam} .ttf/.woff in ${dir}`);
  const widthOf = async (f: string) => (await sharp(path.join(dir, f)).metadata()).width ?? 0;
  const h = files.find((f) => /horizontal.*\.(jpg|png)$/.test(f)), v = files.find((f) => /vertical.*\.png$/.test(f));
  if (!h || (await widthOf(h)) < 1500) fail('header logo (full-colour-reversed horizontal) export missing or < 1500 px wide');
  if (!v || (await widthOf(v)) < 300) fail('footer ink-purple vertical mark export missing or < 300 px wide');
  if (!readFileSync('next.config.ts', 'utf8').includes('lib/ticket-pdf-assets')) fail('next.config.ts does not trace lib/ticket-pdf-assets');
} else if (cmd === 'trace') {
  // After `pnpm build`: the route and the ITN route (email attachment) must both carry the fonts and logos in their file trace.
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  if (!existsSync('.next/server')) { fail('.next/server missing: run pnpm build first'); } else {
    const traces = walk('.next/server').filter((p) => p.endsWith('.nft.json'));
    for (const route of ['api/tickets/pdf', 'api/tickets/itn']) {
      const t = traces.find((p) => p.includes(`${route}/route.js.nft.json`));
      if (!t) { fail(`no nft trace for ${route}`); continue; }
      const files: string[] = JSON.parse(readFileSync(t, 'utf8')).files;
      if (!files.some((f) => f.includes('ticket-pdf-assets') && /\.(ttf|otf|woff)$/.test(f))) fail(`${route}: fonts not in trace`);
      if (!files.some((f) => f.includes('ticket-pdf-assets') && /\.(png|jpg)$/.test(f))) fail(`${route}: logos not in trace`);
    }
  }
} else if (cmd === 'deps') {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = readFileSync('pnpm-lock.yaml', 'utf8');
  for (const [name, ver] of [['pdf-lib', '1.17.1'], ['@pdf-lib/fontkit', '1.1.1']] as const) {
    if (pkg.dependencies?.[name] !== ver) fail(`${name} must be pinned exactly to ${ver} in dependencies (got ${pkg.dependencies?.[name]})`);
    if (!lock.includes(`${name}@${ver}`)) fail(`${name}@${ver} not in pnpm-lock.yaml`);
  }
  for (const banned of ['puppeteer', 'playwright-core', '@react-pdf/renderer', 'jspdf', 'pdfkit']) if (pkg.dependencies?.[banned]) fail(`unexpected runtime dependency ${banned}`);
} else if (cmd === 'review-order') {
  const approval = path.join(SANDBOX, 'codi-approval.txt'), pdf = path.join(SANDBOX, 'fixture.pdf');
  if (!existsSync(pdf)) fail(`missing ${pdf}: run render first`);
  if (!existsSync(approval)) fail(`missing ${approval} (Codi's approval of the rendered PDF)`);
  else if (existsSync(pdf) && statSync(approval).mtimeMs < statSync(pdf).mtimeMs) fail('Codi approval is older than the latest fixture.pdf render: re-render means re-review');
  else if (readFileSync(approval, 'utf8').trim().length < 10) fail('approval file is empty');
} else {
  console.error(`unknown command ${cmd}`);
  process.exit(2);
}

if (fails.length) { for (const m of fails) console.error('FAIL:', m); process.exit(1); }
console.log(`ok: ${cmd}`);
