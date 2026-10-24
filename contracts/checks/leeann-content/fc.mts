// leeann-content-build F1 (FC): Privacy, Terms and the company-documents (Constitution) page, reproduced
// verbatim from Lee-Ann's 24 Oct 2026 documents.
// Usage: pnpm exec tsx contracts/checks/leeann-content/fc.mts <cmd>
//   golden | render
// `render` serves the app (LEEANN_BASE_PORT to reuse a running dev server) and reads the real HTML.
import {
  NOS_HOST, SAOC_HOST, anchorsOf, assertNoPhantoms, assertVerbatimInOrder, fail, finish, get, htmlToBlocks,
  mdToBlocks, readSource, serve, stripWs,
} from './lib.mts';

interface Doc {
  source: string;
  path: string;
  hosts: string[];
  /** Page chrome that is allowed beside her text (eyebrow, hero title the design owns). */
  chrome: string[];
  /** Her title line is the one <h1> (Constitution keeps its own title, ruling Q-D9). */
  h1: 'her-title' | string;
  links: string[];
}

const DOCS: Doc[] = [
  {
    source: 'privacy-policy', path: '/privacy', hosts: [SAOC_HOST, NOS_HOST], chrome: ['Legal'], h1: 'her-title',
    links: ['https://saoc.co.za/', 'https://inforegulator.org.za/complaints/', 'https://inforegulator.org.za/contact-us/', 'mailto:secretary@saoc.co.za'],
  },
  {
    source: 'terms-and-conditions', path: '/terms', hosts: [SAOC_HOST, NOS_HOST], chrome: ['Legal'], h1: 'her-title',
    // Q-D5 default: the two no.saoc.co.za links are published exactly as she wrote them.
    links: ['https://no.saoc.co.za/refunds', 'https://no.saoc.co.za/contact'],
  },
  { source: 'company-constitution', path: '/constitution', hosts: [SAOC_HOST], chrome: ['Governance', 'Constitution'], h1: 'Constitution', links: [] },
];

const cmd = process.argv[2];

if (cmd === 'golden') {
  // The extraction of her files is stable: block counts, and her struck-through text never leaks in.
  const counts: Array<[string, number]> = [['privacy-policy', 79], ['terms-and-conditions', 103], ['company-constitution', 3]];
  for (const [name, count] of counts) {
    const blocks = mdToBlocks(readSource(name));
    if (blocks.length !== count) fail(`${name}: expected ${count} blocks, got ${blocks.length}`);
  }
  const constitution = mdToBlocks(readSource('company-constitution')).join(' ');
  if (/Not yet published|contact the Secretary|founding document/i.test(constitution)) fail('struck-through constitution text leaked into the golden');
  if (!constitution.includes('1978/0040408')) fail('constitution registration number must be her "1978/0040408" (Q-D9 slash form is not applied)');
  finish('fc golden');
} else if (cmd === 'render') {
  const served = await serve();
  try {
    for (const doc of DOCS) {
      const expected = mdToBlocks(readSource(doc.source), doc.source);
      for (const host of doc.hosts) {
        const label = `${host}${doc.path}`;
        const reply = await get(served.port, host, doc.path);
        if (reply.status !== 200) {
          fail(`${label}: HTTP ${reply.status}`);
          continue;
        }
        const rendered = htmlToBlocks(reply.body);
        assertVerbatimInOrder(label, expected, rendered);
        assertNoPhantoms(label, expected, rendered, doc.chrome);
        const h1s = [...reply.body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
        const wantH1 = doc.h1 === 'her-title' ? expected[0] : doc.h1;
        if (h1s.length !== 1 || stripWs(h1s[0]) !== stripWs(wantH1)) fail(`${label}: want exactly one <h1> "${wantH1}", got ${JSON.stringify(h1s)}`);
        const hrefs = anchorsOf(reply.body).map((a) => a.href);
        for (const link of doc.links) if (!hrefs.includes(link)) fail(`${label}: link ${link} must be an anchor exactly as written`);
        if (doc.source === 'privacy-policy') {
          const text = rendered.join(' ');
          if (!text.includes('OWZO')) fail(`${label}: "OWZO" is published as written (Q-D4 default)`);
          if (/\bOzow\b/.test(text)) fail(`${label}: "Ozow" must not replace her "OWZO" until she answers Q-D4`);
        }
      }
    }
  } finally {
    served.stop();
  }
  finish('fc render');
} else {
  console.error('usage: fc.mts golden|render');
  process.exit(2);
}
