// F24 (launch-weekend, design-cb P1/P2-1/P2-2/P2-3) - the pure title and description rules, shared by the live sweep and the
// offline self-test. No I/O here. Rule ids: T1 duplicate segment, T2 home, T3 NOS inner template, T4 NOS hub, T5 FAQ = h1,
// T6 non-NOS suffix; D1 over 160, D2 under 70 without a sentence-cut lede, D3 ends mid-word or on an ellipsis, D4 missing.
export const SITE = 'South African Orchid Council';
export const NOS_SUFFIX = ' — National Orchid Show | SAOC';
export const NOS_HUB = 'National Orchid Show | South African Orchid Council';
export const NOS_HUB_ROUTE = '/national-show';
export const FAQ_ROUTE = '/national-show/faq';
export const DESC_MIN = 70;
export const DESC_MAX = 160;
export const LEDE_MAX = 155;

const SENTENCE_END = /[.!?]["'’”)]?$/;
const norm = (t) => t.replace(/\s+/g, ' ').trim();
// nos-critique-r12 F4 exception (lead ruling 2026-10-18, Codi R7: no meta-talk): the ONLY route whose description may end on an ellipsis.
// Its page renders no lede that fits D1-D4, so its description must be ellipsisCut() of one of its own rendered ledes, words never added.
// Replaced when Lee-Ann supplies a shorter lede; then this list goes back to empty. Every other route with an ellipsis still fails D3.
export const ELLIPSIS_EXCEPTIONS = ['/national-show/symposium'];
/** The longest prefix of `text` that ends on a word boundary within LEDE_MAX - 1 chars, plus '…' (so <= LEDE_MAX); null when it already fits. */
export function ellipsisCut(text, max = LEDE_MAX - 1) {
  const s = norm(text || '');
  if (s.length <= max) return null;
  let k = max;
  while (k > 0 && s[k] !== ' ') k--;
  return k > 0 ? `${s.slice(0, k).replace(/\s+$/, '')}…` : null;
}
const segments = (t) => t.split(/\s+\|\s+|\s+—\s+/).map((s) => s.trim().toLowerCase()).filter(Boolean);

export const isNosInner = (route) => route.startsWith('/national-show/');

export function titleProblems(route, title, h1) {
  const out = [];
  const t = norm(title || '');
  if (!t) return [['T1', 'title is empty']];
  const segs = segments(t);
  if (new Set(segs).size !== segs.length) out.push(['T1', `title repeats a segment: "${t}"`]);
  if (t.split(' | ').length > 2) out.push(['T1', `title carries more than one " | " suffix: "${t}"`]);
  if (route === '/') {
    if (t !== SITE) out.push(['T2', `home title is "${t}", want exactly "${SITE}"`]);
  } else if (route === NOS_HUB_ROUTE) {
    if (t !== NOS_HUB) out.push(['T4', `NOS hub title is "${t}", want "${NOS_HUB}"`]);
  } else if (isNosInner(route)) {
    if (!t.endsWith(NOS_SUFFIX) || t.length === NOS_SUFFIX.length) out.push(['T3', `NOS inner title "${t}" must be "<page>${NOS_SUFFIX}"`]);
    else {
      const head = t.slice(0, -NOS_SUFFIX.length);
      if (/national (orchid )?show/i.test(head)) out.push(['T3', `NOS inner title head "${head}" repeats the National Show name`]);
      if (route === FAQ_ROUTE && h1 && head !== norm(h1)) out.push(['T5', `FAQ title head "${head}" must equal the h1 "${norm(h1)}"`]);
    }
  } else if (!t.endsWith(` | ${SITE}`) || t.length === ` | ${SITE}`.length) {
    out.push(['T6', `title "${t}" must be "<page> | ${SITE}"`]);
  }
  return out;
}

// Reference cutter: the longest prefix of text that is <= max chars and ends on a sentence boundary (. ! ? followed by space
// or end). Never cuts mid-word. null when no boundary fits.
export function sentenceCut(text, max) {
  const t = norm(text);
  for (let i = Math.min(max, t.length) - 1; i >= 0; i--) {
    if (/[.!?]/.test(t[i]) && (i === t.length - 1 || t[i + 1] === ' ')) return t.slice(0, i + 1);
  }
  return null;
}

// `lede` is one string or an array: the page's first paragraphs (see readMeta). A description passes when it is a cut of any one.
export function isLedeCut(desc, lede) {
  if (Array.isArray(lede)) return lede.some((l) => isLedeCut(desc, l));
  const d = norm(desc);
  const l = norm(lede || '');
  if (!d || !l.startsWith(d) || d.length > LEDE_MAX || !SENTENCE_END.test(d)) return false;
  return d.length === l.length || l[d.length] === ' ';
}

export function descProblems(desc, lede, route) {
  const d = norm(desc || '');
  if (!d) return [['D4', 'description is missing']];
  const out = [];
  if (d.length > DESC_MAX) out.push(['D1', `description is ${d.length} chars, max ${DESC_MAX}`]);
  const excepted = ELLIPSIS_EXCEPTIONS.includes(route) && (Array.isArray(lede) ? lede : [lede || '']).some((l) => ellipsisCut(l) === d);
  if (!excepted && (/(…|\.\.\.)$/.test(d) || !SENTENCE_END.test(d))) out.push(['D3', `description does not end on a sentence boundary: "...${d.slice(-30)}"`]);
  if (d.length < DESC_MIN && !isLedeCut(d, lede)) out.push(['D2', `description is ${d.length} chars (<${DESC_MIN}) and is not a sentence-cut of the page lede`]);
  const ledes = (Array.isArray(lede) ? lede : [lede || '']).map(norm);
  if (ledes.some((l) => l.startsWith(d) && d.length < l.length && l[d.length] !== ' ')) out.push(['D3', 'description cuts the lede mid-word']);
  return out;
}

// F24 A4: the static unsourced "21" claim. The filter-results live region on /societies (<p role="status" aria-live> in
// SocietiesClient, "{filtered.length} societies") is a computed announcement of the rendered list, not the claim, and stays.
const LIVE_REGION = /<[a-z0-9]+\b[^>]*\b(?:role="status"|aria-live="[^"]*")[^>]*>[\s\S]*?<\/[a-z0-9]+>/gi;
export const stripLiveRegions = (html) => html.replace(LIVE_REGION, ' ');
export const STATIC_CLAIM = /\b21 societies across\b|\bnetwork of 21\b|\btwenty-one\b/i;
export function staticClaimHits(html) {
  const m = STATIC_CLAIM.exec(stripLiveRegions(html));
  return m ? [['W1', `static unsourced claim "${m[0]}" is in the markup`]] : [];
}
