// email-shell contract checks. Usage: pnpm exec tsx contracts/checks/email-shell/check-email-shell.mts <cmd> [arg]
//   baseline <dir>  write extracted visible text per template (run ONCE against unchanged origin/main emails/)
//   render          render every fixture to .tmp/sandbox/email-shell/html/<Name>.html
//   families | copy | alt | bands | media | assets | screens | review-order
// Every command exits 0 on pass, 1 on fail, printing each failure.
import { render } from '@react-email/components';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES } from './fixtures.mts';

const SANDBOX = '.tmp/sandbox/email-shell';
const HTML_DIR = path.join(SANDBOX, 'html');
const BASELINE_DIR = '.agent/memory/project/specs/email-shell/goldens/copy-baseline';
const ROYAL = '#211a57';
const GOLD = '#f3f2d6';
const BONE = '#e8e6dc';
const PARCHMENT = '#f4f3ec';
const SAGE = '#384138';
// Alt text permitted on <img>: logo names only. Never text-bearing.
const ALLOWED_ALT = new Set(['', 'National Orchid Show 2027', 'South African Orchid Council']);
// Visible strings the shell is allowed to ADD around untouched body copy.
// Functional QR alt kept verbatim from origin/main (Codi ruling): `QR code for booking reference ${bookingRef}`.
const QR_ALT = /^QR code for booking reference TEST-000[12]$/;
const SHELL_ADDED = ['REG# 1978/004040/08 NPO 043-901', 'REG# 1978/004040/08 · NPO 043-901', 'South African Orchid Council — saoc.co.za'];
const fails: string[] = [];
const fail = (m: string) => fails.push(m);

async function htmlOf(name: string): Promise<string> {
  const f = FIXTURES.find((x) => x.name === name);
  if (!f) throw new Error(`no fixture ${name}`);
  return render(f.element);
}

function visibleText(html: string): string {
  let t = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    // hidden preheader (react-email <Preview> and the shell's own) is not visible copy
    .replace(/<div[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[​-‏⁠﻿͏]/g, '')
    .replace(/\s+/g, ' ').trim();
  for (const s of SHELL_ADDED) t = t.split(s).join(' ').replace(/\s+/g, ' ').trim();
  return t;
}

function tags(html: string, tag: string): string[] {
  return html.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) ?? [];
}

function pngWidth(p: string): number {
  const b = readFileSync(p);
  return b.readUInt32BE(16);
}

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === 'baseline') {
  const dir = arg ?? BASELINE_DIR;
  mkdirSync(dir, { recursive: true });
  for (const f of FIXTURES) writeFileSync(path.join(dir, `${f.name}.txt`), visibleText(await htmlOf(f.name)) + '\n');
  console.log(`baseline written to ${dir}`);
  process.exit(0);
}

if (cmd === 'render') {
  mkdirSync(HTML_DIR, { recursive: true });
  for (const f of FIXTURES) writeFileSync(path.join(HTML_DIR, `${f.name}.html`), await htmlOf(f.name));
  console.log(`rendered ${FIXTURES.length} templates to ${HTML_DIR}`);
  process.exit(0);
}

const scoped = FIXTURES;

if (cmd === 'families') {
  for (const f of scoped) {
    const html = await htmlOf(f.name);
    if (!new RegExp(`data-email-shell="${f.family}"`).test(html)) fail(`${f.name}: not rendered through EmailShell family ${f.family}`);
    const src = readFileSync(`emails/${f.name}.tsx`, 'utf8');
    if (!/EmailShell/.test(src)) fail(`${f.name}: source does not use EmailShell`);
  }
} else if (cmd === 'copy') {
  for (const f of FIXTURES) {
    const bp = path.join(BASELINE_DIR, `${f.name}.txt`);
    if (!existsSync(bp)) { fail(`${f.name}: missing baseline ${bp}`); continue; }
    const base = readFileSync(bp, 'utf8').trim();
    const now = visibleText(await htmlOf(f.name));
    if (base !== now) fail(`${f.name}: visible copy changed\n  baseline: ${base}\n  now:      ${now}`);
  }
} else if (cmd === 'alt') {
  for (const f of scoped) {
    for (const img of tags(await htmlOf(f.name), 'img')) {
      const m = img.match(/\balt="([^"]*)"/);
      if (!m) fail(`${f.name}: <img> without alt attribute: ${img}`);
      else if (!ALLOWED_ALT.has(m[1]) && !QR_ALT.test(m[1])) fail(`${f.name}: disallowed alt "${m[1]}"`);
    }
  }
} else if (cmd === 'bands') {
  const hex = /#[0-9a-fA-F]{6}\b/;
  for (const f of scoped) {
    const html = await htmlOf(f.name);
    let royalBands = 0;
    for (const t of [...tags(html, 'td'), ...tags(html, 'table'), ...tags(html, 'body')]) {
      const attr = t.match(/\bbgcolor="(#[0-9a-fA-F]{6})"/i)?.[1];
      const style = t.match(/style="([^"]*)"/i)?.[1] ?? '';
      const css = style.match(new RegExp(`background-color:\\s*(${hex.source})`, 'i'))?.[1];
      if (attr && !css) fail(`${f.name}: bgcolor without inline background-color: ${t}`);
      if (css && !attr) fail(`${f.name}: inline background-color without bgcolor: ${t}`);
      if (attr && css && attr.toLowerCase() !== css.toLowerCase()) fail(`${f.name}: bgcolor/background-color mismatch: ${t}`);
      if (attr?.toLowerCase() === ROYAL) royalBands++;
    }
    const outer = f.family === 'D' ? BONE : GOLD;
    if (!new RegExp(`bgcolor="${outer}"`, 'i').test(html)) fail(`${f.name}: outer ${outer} background missing`);
    if (f.family === 'A' || f.family === 'B') {
      if (royalBands < 2) fail(`${f.name}: family ${f.family} needs royal header and footer bands, found ${royalBands}`);
    } else if (f.family === 'C') {
      if (royalBands < 1) fail(`${f.name}: family C needs the royal top rule`);
      if (tags(html, 'img').length) fail(`${f.name}: family C must carry no logo image`);
    } else {
      if (!new RegExp(`bgcolor="${PARCHMENT}"`, 'i').test(html)) fail(`${f.name}: family D parchment header/card ${PARCHMENT} missing`);
      if (!new RegExp(`bgcolor="${SAGE}"`, 'i').test(html)) fail(`${f.name}: family D sage footer ${SAGE} missing`);
      if (royalBands) fail(`${f.name}: family D must not use NOS royal`);
    }
    if (!/color-scheme/.test(html) || !/supported-color-schemes/.test(html)) fail(`${f.name}: color-scheme / supported-color-schemes not declared`);
  }
} else if (cmd === 'media') {
  for (const f of scoped) {
    const html = await htmlOf(f.name);
    if (!/@media[^{]*max-width:\s*620px/.test(html)) fail(`${f.name}: 620px stack media query missing (applies at 375px viewport)`);
    if ((html.match(/<style\b/gi) ?? []).length > 1 && !/data-email-shell/.test(html)) fail(`${f.name}: more than one <style>`);
  }
} else if (cmd === 'assets') {
  const want: Array<[string, number]> = [
    ['public/images/email/nos-reversed-gold-horizontal-560.png', 560],
    ['public/images/email/nos-reversed-gold-vertical-240.png', 240],
    ['public/images/email/saoc-horizontal-colour-on-light-560.png', 560],
    ['public/images/email/saoc-horizontal-colour-on-dark-440.png', 440],
  ];
  for (const [p, w] of want) {
    if (!existsSync(p)) fail(`missing ${p}`);
    else if (pngWidth(p) !== w) fail(`${p}: width ${pngWidth(p)}, expected ${w}`);
  }
  // D exports are pure resizes of the media-kit-complete lockups: same aspect ratio as the source
  const KIT = 'public/downloads/media-kit/saoc/lockup/saoc-lockup-south-african-orchid-council-horizontal-colour-on-';
  for (const [exp, src] of [
    ['public/images/email/saoc-horizontal-colour-on-light-560.png', `${KIT}light.png`],
    ['public/images/email/saoc-horizontal-colour-on-dark-440.png', `${KIT}dark.png`],
  ]) {
    if (!existsSync(src)) { fail(`BLOCKED: media-kit-complete source missing ${src}`); continue; }
    if (!existsSync(exp)) continue;
    const ratio = (f: string) => readFileSync(f).readUInt32BE(16) / readFileSync(f).readUInt32BE(20);
    if (Math.abs(ratio(exp) - ratio(src)) / ratio(src) > 0.01) fail(`${exp}: aspect differs from ${src} (not a pure resize)`);
  }
  // displayed sizes, referenced from the shell by absolute /images/email/ path
  const shell = existsSync('emails/_shared/EmailShell.tsx') ? readFileSync('emails/_shared/EmailShell.tsx', 'utf8') : '';
  if (!/nos-reversed-gold-horizontal-560\.png/.test(shell) || !/280/.test(shell)) fail('EmailShell: NOS header logo (560 asset displayed at 280) not wired');
  if (!/nos-reversed-gold-vertical-240\.png/.test(shell) || !/120/.test(shell)) fail('EmailShell: NOS footer lockup (240 asset displayed at 120) not wired');
  if (!/saoc-horizontal-colour-on-light-560\.png/.test(shell)) fail('EmailShell: SAOC header lockup (560 asset displayed at 280) not wired');
  if (!/saoc-horizontal-colour-on-dark-440\.png/.test(shell) || !/220/.test(shell)) fail('EmailShell: SAOC footer lockup (440 asset displayed at 220) not wired');
} else if (cmd === 'screens') {
  for (const fam of ['A', 'B', 'C', 'D']) {
    const p = path.join(SANDBOX, 'screens', `family-${fam}.png`);
    if (!existsSync(p) || statSync(p).size < 5000) fail(`missing or empty screenshot ${p}`);
  }
} else if (cmd === 'review-order') {
  // Codi must approve the renders BEFORE the first send: approval file older than every gws manifest.
  const ap = path.join(SANDBOX, 'codi-approval.txt');
  if (!existsSync(ap)) fail(`missing ${ap} (Codi review of per-family renders, before first send)`);
  else {
    const apMs = statSync(ap).mtimeMs;
    for (const fam of ['A', 'B', 'C', 'D']) {
      const mp = `.agent/memory/scratch/email-shell-gws-manifest-${fam}.json`;
      if (existsSync(mp) && statSync(mp).mtimeMs < apMs) fail(`${mp} is older than Codi's approval: sent before review`);
    }
  }
} else {
  console.error(`unknown command ${cmd}`);
  process.exit(2);
}

if (fails.length) { for (const m of fails) console.error('FAIL:', m); process.exit(1); }
console.log(`ok: ${cmd}`);
