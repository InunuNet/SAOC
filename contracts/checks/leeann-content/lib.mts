// Shared helpers for the leeann-content-build contract checks (fc.mts, fe.mts, fd.mts, ff.mts, scope.mts).
// Her documents are the source of truth: goldens/source/*.txt are byte copies of the Drive extracts.
// Every comparison ignores whitespace and nothing else, so a changed apostrophe, a corrected typo or a
// dropped clause fails the check.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';

export const SPEC = '.agent/memory/project/specs/leeann-content-build';
export const GOLDENS = `${SPEC}/goldens`;

export const fails: string[] = [];
export function fail(message: string): void {
  fails.push(message);
}
export function finish(label: string): never {
  if (fails.length > 0) {
    for (const message of fails) console.error(`FAIL: ${message}`);
    console.error(`${label}: ${fails.length} failure(s)`);
    process.exit(1);
  }
  console.log(`${label}: ok`);
  process.exit(0);
}

export function readText(path: string): string {
  if (!existsSync(path)) {
    fail(`missing file ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

export function readSource(name: string): string {
  return readFileSync(`${GOLDENS}/source/${name}.txt`, 'utf8');
}

/** Removes every kind of whitespace so two texts compare on their characters alone. */
export function stripWs(value: string): string {
  return value.replace(/[\s ​  ]+/g, '');
}

interface Correction {
  doc: string;
  from: string;
  to: string;
}

/** Corrections Lee-Ann has approved (goldens/typo-corrections.json). Empty until she answers. */
export function approvedCorrections(doc: string): Correction[] {
  const raw = JSON.parse(readFileSync(`${GOLDENS}/typo-corrections.json`, 'utf8')) as { approved: Correction[] };
  return raw.approved.filter((entry) => entry.doc === doc);
}

function applyCorrections(doc: string, text: string): string {
  return approvedCorrections(doc).reduce((acc, c) => acc.split(c.from).join(c.to), text);
}

const ESCAPED_ASTERISK = '\u0001';

/**
 * Her markdown extract as the plain paragraphs a reader sees: struck-through text (her own
 * "replace this" markers) removed, bold and emphasis markers and list bullets dropped, links reduced
 * to their visible text, escapes undone. One entry per non-empty line.
 */
export function mdToBlocks(markdown: string, doc?: string): string[] {
  const blocks: string[] = [];
  for (const rawLine of markdown.split('\n')) {
    let line = rawLine.replace(/\\\*/g, ESCAPED_ASTERISK);
    while (/~~[^~]*~~/.test(line)) line = line.replace(/~~[^~]*~~/g, '');
    line = line.replace(/~~/g, '');
    line = line.replace(/\[([^\]]*)\]\((?:[^)]*)\)/g, '$1');
    line = line.replace(/<(https?:[^>]+)>/g, '$1');
    line = line.replace(/^\s*[*-]\s+/, '');
    line = line.replace(/\*+/g, '');
    line = line.replace(/^#+\s*/, '');
    line = line.replace(/\\([\\`_{}[\]()#+\-.!|<>])/g, '$1').replace(new RegExp(ESCAPED_ASTERISK, 'g'), '*');
    line = line.trim();
    if (line === '' || /^[\p{P}\s]+$/u.test(line)) continue;
    blocks.push(doc ? applyCorrections(doc, line) : line);
  }
  return blocks;
}

/** The `[text](url)` pairs that survive her struck-through spans. */
export function mdLinks(markdown: string): Array<{ text: string; url: string }> {
  const links: Array<{ text: string; url: string }> = [];
  for (const rawLine of markdown.split('\n')) {
    let line = rawLine;
    while (/~~[^~]*~~/.test(line)) line = line.replace(/~~[^~]*~~/g, '');
    for (const match of line.matchAll(/\[([^\]]+)\]\((https?:[^)]+)\)/g)) {
      links.push({ text: match[1].replace(/\*+/g, '').trim(), url: match[2] });
    }
  }
  return links;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…',
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

const BLOCK_TAGS =
  'p|div|section|article|aside|main|h[1-6]|li|ul|ol|dl|dt|dd|br|tr|td|th|table|details|summary|figure|figcaption|form|label|button|blockquote|hr|address';

function sliceElement(html: string, attribute: string): string {
  const open = new RegExp(`<([a-z0-9]+)\\b[^>]*\\b${attribute}\\b[^>]*>`, 'i').exec(html);
  if (!open) return '';
  const tag = open[1].toLowerCase();
  const tokens = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  tokens.lastIndex = open.index + open[0].length;
  let depth = 1;
  for (let m = tokens.exec(html); m; m = tokens.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(open.index + open[0].length, m.index);
  }
  return html.slice(open.index + open[0].length);
}

/**
 * The visible text blocks of a rendered page's <main> (or of the element carrying `within`, an
 * attribute name such as data-plan-guide). Navigation, header, footer, scripts and styles are dropped.
 */
export function htmlToBlocks(html: string, within?: string): string[] {
  let scope = within ? sliceElement(html, within) : '';
  if (!scope && !within) {
    const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
    scope = main ? main[1] : html;
  }
  const cleaned = scope
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(nav|header|footer)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(cleaned)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '');
}

export function anchorsOf(html: string, within?: string): Array<{ text: string; href: string }> {
  const scope = within ? sliceElement(html, within) : html;
  const anchors: Array<{ text: string; href: string }> = [];
  for (const m of scope.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    anchors.push({
      href: decodeEntities(m[1]),
      text: decodeEntities(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(),
    });
  }
  return anchors;
}

/** Every expected block appears in the rendered blocks, in order, character for character. */
export function assertVerbatimInOrder(label: string, expected: string[], rendered: string[]): void {
  const haystack = stripWs(rendered.join(''));
  let cursor = 0;
  for (const block of expected) {
    const needle = stripWs(block);
    const at = haystack.indexOf(needle, cursor);
    if (at === -1) {
      fail(`${label}: not found verbatim, in order: "${block.slice(0, 90)}${block.length > 90 ? '...' : ''}"`);
      return;
    }
    cursor = at + needle.length;
  }
}

/** Every rendered block is her text (a piece of the corpus) or named chrome. Reports the first six. */
export function assertNoPhantoms(label: string, corpus: string[], rendered: string[], chrome: readonly string[] = []): void {
  const haystack = stripWs(corpus.join(''));
  const allowed = new Set(chrome.map(stripWs));
  const phantoms = rendered.filter((block) => {
    const key = stripWs(block);
    return key !== '' && !allowed.has(key) && !haystack.includes(key);
  });
  for (const block of phantoms.slice(0, 6)) {
    fail(`${label}: copy that is not in her documents: "${block.slice(0, 110)}${block.length > 110 ? '...' : ''}"`);
  }
  if (phantoms.length > 6) fail(`${label}: ...and ${phantoms.length - 6} more blocks that are not in her documents`);
}

export interface Reply {
  status: number;
  location: string | null;
  body: string;
}

export function get(port: number, host: string, path: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers: { host, 'x-forwarded-host': host } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            location: typeof res.headers.location === 'string' ? res.headers.location : null,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    req.on('error', reject);
    req.setTimeout(120_000, () => req.destroy(new Error(`timeout ${path}`)));
    req.end();
  });
}

export interface Served {
  port: number;
  stop: () => void;
}

/**
 * The server the render checks read. LEEANN_BASE_PORT points them at a server that is already up (a
 * dev server the developer has open, started with BETA_PASSWORD_WALL_OFF=true); otherwise a dev server
 * starts on a private port. Dev mode on purpose: it needs no build and no site-origin env.
 */
export async function serve(): Promise<Served> {
  const existing = process.env.LEEANN_BASE_PORT;
  if (existing) return { port: Number(existing), stop: () => undefined };
  const port = 3071;
  const env = { ...process.env, PORT: String(port), BETA_PASSWORD_WALL_OFF: 'true' };
  // Detached so the whole process group (pnpm, next, its worker) is stopped, not just the wrapper.
  const child: ChildProcess = spawn('pnpm', ['exec', 'next', 'dev', '-p', String(port)], { env, stdio: 'ignore', detached: true });
  const stop = (): void => {
    try {
      if (child.pid) process.kill(-child.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  };
  process.on('exit', stop);
  for (let i = 0; i < 120; i++) {
    try {
      const r = await get(port, 'localhost', '/api/admin/whoami');
      if (r.status) return { port, stop };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  stop();
  throw new Error('dev server did not start (is another next dev already running? set LEEANN_BASE_PORT)');
}

export const SAOC_HOST = 'localhost';
export const NOS_HOST = 'nos.localhost';
