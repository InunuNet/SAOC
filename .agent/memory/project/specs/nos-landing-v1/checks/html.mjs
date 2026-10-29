// Dependency-free HTML parser for the nos-landing-v1 checks. React SSR output is well formed, so a tolerant
// tokenizer is enough; node_modules is not guaranteed in a gate sandbox and nothing may be installed.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'em', 'i', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'wbr']);
const SKIP_TEXT = new Set(['script', 'style', 'template', 'noscript', 'head', 'title']);

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decode(s) {
  return s.replace(/&(?:#x([0-9a-fA-F]+)|#(\d+)|([a-zA-Z]+));/g, (m, hex, dec, name) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    return name in NAMED ? NAMED[name] : m;
  });
}

export function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  let pos = 0;
  let seq = 0;
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][^\s>]*)\s*>|<([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m.index > pos) cur.children.push({ text: decode(html.slice(pos, m.index)), parent: cur, seq: seq++ });
    pos = re.lastIndex;
    if (m[0].startsWith('<!')) continue;
    if (m[1]) {
      const name = m[1].toLowerCase();
      let n = cur;
      while (n && n.tag !== name) n = n.parent;
      if (n && n.parent) cur = n.parent;
      continue;
    }
    const tag = m[2].toLowerCase();
    const attrs = {};
    for (const a of m[3].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    const node = { tag, attrs, children: [], parent: cur, seq: seq++ };
    cur.children.push(node);
    if (RAW.has(tag) && !m[4]) {
      const end = html.toLowerCase().indexOf(`</${tag}`, pos);
      const stop = end === -1 ? html.length : end;
      node.children.push({ text: html.slice(pos, stop), parent: node, seq: seq++ });
      const close = html.indexOf('>', stop);
      pos = re.lastIndex = close === -1 ? html.length : close + 1;
      continue;
    }
    if (!VOID.has(tag) && !m[4]) cur = node;
  }
  if (pos < html.length) cur.children.push({ text: decode(html.slice(pos)), parent: cur, seq: seq++ });
  return root;
}

export function walk(node, fn) {
  if (node.tag) fn(node);
  for (const c of node.children ?? []) walk(c, fn);
}

export function all(root) {
  const out = [];
  walk(root, (n) => out.push(n));
  return out;
}

const collapse = (s) => s.replace(/[ \t\r\n\f]+/g, ' ').trim();

/** Visible text: script/style/template/head/title excluded; a space where a block-level element starts or ends. */
export function text(node) {
  let out = '';
  const rec = (n) => {
    if (n.text !== undefined) { out += n.text; return; }
    if (SKIP_TEXT.has(n.tag)) return;
    const block = n.tag === 'br' || !INLINE.has(n.tag);
    if (block) out += ' ';
    for (const c of n.children) rec(c);
    if (block) out += ' ';
  };
  for (const c of node.children ?? [node]) rec(c);
  return collapse(out);
}

export function ancestors(node) {
  const out = [];
  for (let p = node.parent; p; p = p.parent) out.push(p);
  return out;
}

const HIDING_CLASSES = new Set(['sr-only', 'hidden', 'invisible', 'visually-hidden']);
export function hiddenReason(node) {
  for (const n of [node, ...ancestors(node)]) {
    if (!n.tag || n.tag === '#root') continue;
    if (SKIP_TEXT.has(n.tag)) return `inside <${n.tag}>`;
    if ('hidden' in n.attrs) return 'hidden attribute';
    if (n.attrs['aria-hidden'] === 'true') return 'aria-hidden';
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.attrs.style ?? '')) return 'style hides it';
    if ((n.attrs.class ?? '').split(/\s+/).some((c) => HIDING_CLASSES.has(c))) return 'a hiding class';
  }
  return null;
}
