// F1a: EVERY alert on a SAOC surface is classified, and anything not explicitly (b) or (c) must be an (a) error summary that matches the golden.
//   Enumerated by scanning every .tsx under app/ and components/ (only NOS chrome, components/nos-chrome/, is excluded; NOS-routed components such as components/vendors/* and components/tickets/* are scanned ON PURPOSE, the standalone-focus NOS-routed exemption of check-focus-classes-static.mjs does not apply here) for role="alert", role={...'alert'...} and aria-live="assertive": no file list.
//   (a) error summary / page-level error: border-2 border-[var(--status-error)], an aria-hidden icon, status-error text, NO background tint.
//   (b) field-level alert of a named allowed kind, (c) not an error (status notice): listed in goldens/alert-classes.json with a reason. New alerts default to (a).
// The old version only inspected alerts that already had the status-error border, so a summary MISSING its border was invisible to it (the unsubscribe page).
// Static: the vendor forms render only on the NOS host, which redirects away from the SAOC host in a browser.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { check, finish } from './lib.mjs';
const ROOTS = ['app', 'components']; const EXCLUDED = ['components/nos-chrome/'];
const SPEC = process.env.DC_ALERT_CLASSES || '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/alert-classes.json';
const classes = JSON.parse(readFileSync(SPEC, 'utf8')).classes;
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? (n === 'node_modules' ? [] : walk(p)) : /\.tsx$/.test(n) ? [p] : []; });
// The element's opening tag: from the "<" before the marker to the first ">" that closes it (a ">" that ends a line or follows a quote/brace).
const openingTag = (src, at) => { const start = src.lastIndexOf('<', at); const m = /["}'`]\s*>|>\s*\n/.exec(src.slice(at)); return { start, text: src.slice(start, m ? at + m.index + m[0].length : at + 400) }; };
// Resolve className={IDENT} and ${IDENT} against same-file string constants, so a shared class constant is judged by its value (an imported one stays unresolved and fails (a)).
const consts = (src) => Object.fromEntries([...src.matchAll(/const\s+(\w+)\s*=\s*\n?\s*(['"`])((?:(?!\2)[\s\S])*)\2/g)].map((m) => [m[1], m[3]]));
const resolve = (text, map) => text.replace(/className=\{(\w+)\}/g, (_, id) => `className="${map[id] ?? ''}"`).replace(/\$\{(\w+)\}/g, (_, id) => map[id] ?? '');
const BG = /(^|[\s"'`:])(?!bg-transparent\b)bg-(?!clip|origin|none\b|no-repeat|repeat|center|cover|contain|fixed|local|scroll)[\w\[\]\/().#%-]+/;
const MARK = /role="alert"|role=\{[^}]*'alert'[^}]*\}|aria-live="assertive"/g;
const files = ROOTS.flatMap(walk).filter((f) => !EXCLUDED.some((x) => f.startsWith(x)));
const used = new Set(); const tally = { a: 0, b: 0, c: 0 };
for (const file of files) {
  const src = readFileSync(file, 'utf8'); if (!MARK.test(src)) { MARK.lastIndex = 0; continue; } MARK.lastIndex = 0; const map = consts(src);
  for (const m of src.matchAll(MARK)) {
    const { start, text } = openingTag(src, m.index); const line = src.slice(0, m.index).split('\n').length; const label = `${file}:${line}`;
    const context = src.slice(Math.max(0, start - 300), start) + text;
    const entry = classes.findIndex((c) => c.file === file && context.includes(c.key));
    if (entry >= 0) {
      const c = classes[entry]; used.add(entry); tally[c.class]++; check(Boolean(c.reason), `${label}: classification has no reason`);
      if (c.srOnly) check(/\bsr-only\b/.test(resolve(text, map)), `${label}: (b) ${c.file} withheld alert (${c.key}) is not sr-only: the unsourced copy must not be visible (it needs the sr-only class)`);
      if (c.requireIconAndToken) { const box = resolve(src.slice(start, start + 900), map); check(/<\w*(Alert|Circle|Triangle|Octagon|Icon)\w*[^>]*aria-hidden/.test(box) || /aria-hidden="true">\s*[✕⚠]/.test(box), `${label}: (b) ${c.file} needs an aria-hidden icon beside the text (never colour alone)`); check(box.includes('text-[var(--status-error)]'), `${label}: (b) ${c.file} text is not the status-error token`); }
      continue; }
    tally.a++; const tag = resolve(text, map); const box = resolve(src.slice(start, start + 900), map);
    check(tag.includes('border-[var(--status-error)]'), `${label}: unclassified alert is not an (a) error summary: no border-[var(--status-error)] (list it in goldens/alert-classes.json as (b)/(c) with a reason, or give it the summary border)`);
    check(/\bborder-2\b/.test(tag), `${label}: (a) border is not 2px (needs border-2)`);
    check(!BG.test(tag), `${label}: (a) carries a background tint (${(tag.match(BG) || [''])[0].trim()}), want none (border and icon only)`);
    check(/<\w*(Alert|Circle|Triangle|Octagon|Icon)\w*[^>]*aria-hidden/.test(box) || /aria-hidden="true">\s*[✕⚠]/.test(box), `${label}: (a) no aria-hidden icon beside the text`);
    check(box.includes('text-[var(--status-error)]'), `${label}: (a) text is not the status-error token`);
  }
}
// ErrorText call sites, classified one by one (goldens/alert-classes.json errorTextSites). A panel-level error on ErrorText (a field-level left-border component) is the defect; a new or reclassified use fails until classified.
const sites = JSON.parse(readFileSync(SPEC, 'utf8')).errorTextSites || []; const siteUsed = new Set(); let siteCount = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/<(\w*ErrorText)\b/g)) {
    siteCount++; const line = src.slice(0, m.index).split('\n').length; const label = `${file}:${line}`; const window = src.slice(m.index, m.index + 200);
    const i = sites.findIndex((c) => c.file === file && window.includes(c.key));
    if (i < 0) { check(false, `${label}: <${m[1]}> use is not classified in goldens/alert-classes.json errorTextSites (field or panel); classify it. A panel-level error uses the FormErrorAlert shape, not ErrorText`); continue; }
    siteUsed.add(i); check(Boolean(sites[i].reason), `${label}: ErrorText classification has no reason`);
    check(sites[i].class === 'field', `${label}: panel-level error ("${sites[i].key}") renders through ${m[1]}, a field-level component; use the FormErrorAlert shape (border-2 status-error, aria-hidden icon, status-error text)`);
  }
}
// FIELD STYLING: classifying a site as field is not enough, the component that renders it must BE a field alert (TicketFieldAlert golden): border-l-2 only, a border colour token, no fill, an aria-hidden icon, a text colour token.
const FIELD_BORDER = /\bborder-(error|\[var\(--status-error(-on-dark)?\)\])/; const FIELD_TEXT = /\btext-(error|\[var\(--status-error(-on-dark)?\)\])/;
for (const file of new Set(sites.filter((c) => c.class === 'field').map((c) => c.file))) {
  const src = readFileSync(file, 'utf8'); const defs = [...src.matchAll(/function\s+(\w*ErrorText)\b/g)]; const map = consts(src);
  check(defs.length > 0, `${file}: has field-class ErrorText sites but no local ErrorText definition to check the field styling of`);
  for (const dm of defs) { const at = src.indexOf('role="alert"', dm.index); const label = `${file}:${src.slice(0, dm.index).split('\n').length}`;
    if (at < 0) { check(false, `${label}: ${dm[1]} has no role="alert" element`); continue; }
    const { start, text } = openingTag(src, at); const tag = resolve(text, map); const box = resolve(src.slice(start, start + 900), map);
    check(/\bborder-l-2\b/.test(tag) && !/(^|[\s"'`])border(-2|-[xytrb]-\d)?(\s|["'`])/.test(tag.replace(/border-l-2/, '')), `${label}: field alert ${dm[1]} is not a LEFT-border-only alert (needs border-l-2 and no full box border)`);
    check(FIELD_BORDER.test(tag), `${label}: field alert ${dm[1]} border colour is not an error token (border-error or --status-error)`);
    check(!BG.test(tag), `${label}: field alert ${dm[1]} carries a fill (${(tag.match(BG) || [''])[0].trim()}), want none or bg-transparent`);
    check(/<\w*(Alert|Circle|Triangle|Octagon|Icon)\w*[^>]*aria-hidden/.test(box) || /aria-hidden="true">\s*[✕⚠]/.test(box), `${label}: field alert ${dm[1]} has no aria-hidden icon`);
    check(FIELD_TEXT.test(tag), `${label}: field alert ${dm[1]} text colour is not an error token (text-error or --status-error)`); } }
// A panel entry is satisfied by conversion: it matches no ErrorText use any more AND its key now sits inside a FormErrorAlert (so the alert scan holds its shape). A field entry that matches nothing is stale.
sites.forEach((c, i) => { if (siteUsed.has(i)) return; const src = readFileSync(c.file, 'utf8'); const at = src.indexOf(c.key);
  if (c.class === 'panel') check(at >= 0 && /<FormErrorAlert\b/.test(src.slice(Math.max(0, at - 400), at)), `errorTextSites entry ${i + 1} (${c.file} / ${c.key}): panel-level site is no longer on ErrorText but is not inside a <FormErrorAlert> either`);
  else check(false, `errorTextSites entry ${i + 1} (${c.file} / ${c.key}) matches no ErrorText use: stale, remove it`); });
console.log(`ErrorText sites: ${siteCount}`);
classes.forEach((c, i) => check(used.has(i), `goldens/alert-classes.json entry ${i + 1} (${c.file} / ${c.key}) matches no alert: stale, remove or fix it`));
const total = tally.a + tally.b + tally.c; check(total >= 5, `only ${total} alerts found under ${ROOTS.join(', ')}, the enumeration is broken`);
console.log(`alerts: ${total} (a:${tally.a} b:${tally.b} c:${tally.c})`);
finish('error-summary-static');
