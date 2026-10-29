// mutation-suite: proves the verifier has EFFECT. It builds a conforming page from the golden, confirms verify-landing passes it,
// then applies each wrong-implementation mutant and requires verify-landing to reject it. A mutant that survives means a wrong
// implementation could keep the same text and still pass. Benign variants (wrappers, whitespace, comments, classes) must still pass.
// Usage: node mutation-suite.mjs     exit 0 only if the good page passes, every mutant dies and every benign variant survives.
import { COPY, verify } from './verify-landing.mjs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const U = (id) => COPY.units.find((u) => u.id === id);
const el = (id, tag = 'p', extra = '') => {
  const u = U(id);
  let t = esc(u.text);
  for (const e of u.em) t = t.replace(esc(e), `<em>${esc(e)}</em>`);
  return `<${tag} data-lp="${id}"${extra}>${t}</${tag}>`;
};
const R = (id) => COPY.retained.find((r) => r.id === id);

export function good() {
  const groups = [];
  for (let g = 1; g <= 13; g += 1) {
    groups.push(`<li class="card">${el(`group-${g}-label`, 'p')}${el(`group-${g}-name`, 'h3')}${g <= 10 ? el(`group-${g}-desc`, 'p') : ''}</li>`);
  }
  const stages = [1, 2, 3, 4].map((k) => `<div class="stage">${el(`stage-${k}-label`)}${el(`stage-${k}-title`, 'h3')}${el(`stage-${k}-desc`)}</div>`).join('');
  return `<!DOCTYPE html><html><head><title>The National Orchid Show - Western Cape 2027</title>
<meta name="description" content="${esc(U('hero-lede').text)}"/>
<script type="application/ld+json">${JSON.stringify({ '@type': 'Event', description: U('hero-lede').text })}</script></head>
<body><header><a href="/">Home</a></header><main>
<section data-nos-hero="hub">${el('hero-h1', 'h1')}${el('hero-lede', 'p', ' data-hm-lede=""')}${el('hero-theme')}<a href="/tickets">Tickets</a><a href="/national-show/plan-your-visit">Plan your visit</a></section>
<section data-hm-section="about"><div>${el('about-tagline', 'h2')}${el('about-lead')}${el('about-judging')}<dl>${[1, 2, 3].map((k) => `<div><dd data-lp="stat-${k}">${esc(U(`stat-${k}`).text)}</dd></div>`).join('')}</dl><a href="/national-show/about">About the show</a></div>
<div><p>${esc(R('keep-dates-label').text)}</p><p>${esc(R('keep-dates-line').text)}</p></div></section>
<section data-hm-section="visit">${el('visit-h2', 'h2')}<ul>${['about', 'pyv', 'wte', 'faq'].map((k) => `<li><a href="/national-show/${k}">${el(`card-${k}-title`, 'h3')}${el(`card-${k}-blurb`)}</a></li>`).join('')}</ul></section>
<section data-hm-section="judging">${el('judging-h2', 'h2')}<ul>${groups.join('')}</ul></section>
<section data-hm-section="entry">${el('entry-h2', 'h2')}${stages}${el('entry-cta')}</section>
<section data-hm-section="programme"><p>${esc(R('keep-symposium').text)}</p><p>${esc(R('keep-wosa').text)}</p><p>${esc(R('keep-workshops').text)}</p></section>
<section data-hm-section="exhibit"><p>${esc(R('keep-exhibit-lead').text)}</p><p>${esc(R('keep-exhibit-body').text)}</p></section>
<section data-hm-section="closing">${el('closing-text')}<a href="/tickets">Tickets</a><a href="/national-show/plan-your-visit">Plan your visit</a></section>
</main><footer><p>Stay in touch</p></footer></body></html>`;
}

const swap = (a, b) => (h) => { const A = h.match(new RegExp(`<[a-z0-9]+ data-lp="${a}"[^>]*>.*?</[a-z0-9]+>`))[0]; const B = h.match(new RegExp(`<[a-z0-9]+ data-lp="${b}"[^>]*>.*?</[a-z0-9]+>`))[0]; return h.replace(A, '\u0001').replace(B, A).replace('\u0001', B); };
const sub = (from, to) => (h) => { if (!h.includes(from)) throw new Error(`mutant precondition missing: ${from.slice(0, 60)}`); return h.replace(from, to); };
const t = (id) => esc(U(id).text);

const MUTANTS = {
  'her typo corrected (judges -> judged)': sub('can be judges for', 'can be judged for'),
  'Ten heading corrected to Thirteen': sub(t('judging-h2'), 'Thirteen judging groups'),
  'curly apostrophe straightened in the lede': sub(el('hero-lede', 'p', ' data-hm-lede=""'), el('hero-lede', 'p', ' data-hm-lede=""').replace('South Africa’s', 'South Africa&#x27;s')),
  'extra visible h1 in the footer': sub('<footer>', '<footer><h1>Stay in touch</h1>'),
  'tag line and lead swapped': swap('about-tagline', 'about-lead'),
  'theme above the lede': swap('hero-lede', 'hero-theme'),
  'stats aria-hidden': sub('<dl>', '<dl aria-hidden="true">'),
  'stats wrong number (10 groups)': sub(t('stat-2'), '10 Judging Groups'),
  'stats missing one': sub(/<div><dd data-lp="stat-3">.*?<\/dd><\/div>/.exec(good())[0], ''),
  'italics dropped in a group description': (h) => h.replace(/<em>Callista[^<]*<\/em>/, (m) => m.replace(/<\/?em>/g, '')),
  'italics added where she has none': sub(el('group-1-desc'), el('group-1-desc').replace('Cattleya', '<em>Cattleya</em>')),
  'groups 11-13 given an empty description': sub('</li><li class="card"><p data-lp="group-12-label"', '<p></p></li><li class="card"><p data-lp="group-12-label"'),
  'group 13 dropped': sub(/<li class="card"><p data-lp="group-13-label".*?<\/li>/.exec(good())[0], ''),
  'old lede still in the meta description': sub(`content="${esc(U('hero-lede').text)}"`, 'content="The National Orchid Show – Western Cape 2027 promises an immersive experience celebrating the beauty, science and future of orchids."'),
  'old closing paragraph kept': sub('</main>', `<p>${esc(COPY.retired.find((r) => r.id === 'old-closing').text)}</p></main>`),
  'old About lead kept in the page': sub('</main>', `<p>${esc(COPY.retired.find((r) => r.id === 'old-about-lead').text)}</p></main>`),
  'Register Here link to an invented URL': sub(el('entry-cta'), `${el('entry-cta')}<a href="https://example.com/register">Register Here</a>`),
  'Register Here dead link': sub(el('entry-cta'), `${el('entry-cta')}<a href="#">Register Here</a>`),
  'registration form rendered': sub(el('entry-cta'), `${el('entry-cta')}<form action="/api/x"><input name="e"/></form>`),
  'link to an unlisted registration route': sub('<a href="/national-show/faq">', '<a href="/national-show/entry-register">'),
  'struck word cloakroom rendered': sub(t('card-wte-blurb'), 'Opening hours, admission, food, photography, cloakroom facilities and accessibility.'),
  'her instruction rendered': sub(el('card-about-blurb'), `${el('card-about-blurb')}<p>Copy needs to be provided for this</p>`),
  'her editorial note rendered': sub('</main>', '<p>The blow needs to be added to this page.</p></main>'),
  'hero h1 demoted to div': sub(el('hero-h1', 'h1'), el('hero-h1', 'div')),
  'second h1 added': sub(el('about-tagline', 'h2'), el('about-tagline', 'h1')),
  'stage label as Stage 1': sub('Stage 02', 'Stage 2'),
  'tag line upper-cased in the text': sub(t('about-tagline'), t('about-tagline').toUpperCase()),
  'a section removed (programme)': sub(/<section data-hm-section="programme">.*?<\/section>/s.exec(good())[0], ''),
  'tag line inside the wrong section': (h) => { const e = el('about-tagline', 'h2'); return h.replace(e, '').replace('<section data-hm-section="visit">', `<section data-hm-section="visit">${e}`); },
  'unit rendered twice': sub(el('stat-1', 'dd'), `${el('stat-1', 'dd')}${el('stat-1', 'dd')}`),
  'copy only in an attribute, not as text': (h) => h.replace(el('about-lead'), `<p data-lp="about-lead" title="${t('about-lead')}"></p>`),
  'copy only in a script (JSON), not rendered': (h) => h.replace(el('about-lead'), `<script data-lp="about-lead">${t('about-lead')}</script>`),
  'copy visually hidden (sr-only)': sub(el('about-lead'), el('about-lead', 'p', ' class="sr-only"')),
  'copy hidden by style': sub(el('about-judging'), el('about-judging', 'p', ' style="display:none"')),
  'group name with a trailing colon': sub('>Laeliinae Species<', '>Laeliinae Species:<'),
  'group label and name merged, label unit missing': sub(el('group-4-label'), ''),
  'invented unit (extra data-lp)': sub('</main>', '<p data-lp="tagline-2">Extra</p></main>'),
  'theme wrapped in quotation marks': sub(t('hero-theme'), `“${t('hero-theme')}”`),
  'closing line dropped': sub(el('closing-text'), ''),
  'sections out of order (entry before judging)': (h) => { const j = /<section data-hm-section="judging">.*?<\/section>/s.exec(h)[0]; return h.replace(j, '').replace('<section data-hm-section="programme">', `${j}<section data-hm-section="programme">`); },
  'external invented link in the page': sub('<a href="/national-show/about">', '<a href="https://nos.example.org/form">'),
  'her corrected wording elsewhere (communicate)': sub('<footer>', '<footer><p>We would love to communicate with you.</p>'),
  'Previous editions linked to a dead hash': sub('</ul></section>\n<section data-hm-section="judging">', '<li><a href="#">Previous editions</a></li></ul></section>\n<section data-hm-section="judging">'),
};

const BENIGN = {
  'extra wrapper spans and classes': (h) => h.replace(/(<p data-lp="about-lead">)(.*?)(<\/p>)/, '$1<span class="x">$2</span>$3').replace('<section data-hm-section="visit">', '<section data-hm-section="visit" class="tone-gold">'),
  'react comment markers between text nodes': (h) => h.replace('Three years in', 'Three years<!-- --> in'),
  'whitespace re-wrapped': (h) => h.replace(/(<h2 data-lp="visit-h2">)Planning a visit/, '$1\n   Planning   a\n visit  '),
  'extra unrelated decorative elements': sub('</main>', '<div class="ornament"><svg aria-hidden="true"></svg></div></main>'),
  'stat split into number and label spans with a space': sub('<dd data-lp="stat-1">3 Years</dd>', '<dd data-lp="stat-1"><span>3</span> <span>Years</span></dd>'),
};

export function run(log = console.log) {
  let bad = 0;
  const base = verify(good());
  if (base.length) { bad += 1; log(`BASELINE FAILS (${base.length}): ${base.slice(0, 5).join(' | ')}`); }
  for (const [name, fn] of Object.entries(MUTANTS)) {
    let out;
    try { out = fn(good()); } catch (e) { bad += 1; log(`BROKEN MUTANT  ${name}: ${e.message}`); continue; }
    const r = verify(out);
    if (!r.length) { bad += 1; log(`SURVIVED       ${name}`); } else log(`killed         ${name}  <- ${r[0].slice(0, 90)}`);
  }
  for (const [name, fn] of Object.entries(BENIGN)) {
    const r = verify(fn(good()));
    if (r.length) { bad += 1; log(`FALSE REJECT   ${name}: ${r[0]}`); } else log(`ok (benign)    ${name}`);
  }
  log(`mutation-suite: ${Object.keys(MUTANTS).length} mutants, ${Object.keys(BENIGN).length} benign variants, ${bad} problem(s)`);
  return bad;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) process.exit(run() ? 1 : 0);
