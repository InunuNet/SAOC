// A14: the gate-render helpers bite. Pure Node, local servers only, no build needed.
import http from 'node:http';
import { awardLinkViolations, followWithAuth } from './_lib.mjs';

const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };
const listen = (handler) => new Promise((resolve) => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => resolve(s)); });
const AUTH = 'Basic c2FuZGJveDpzYW5kYm94LXBhc3M=';

// hop 2 requires the auth header and answers `final`; hop 1 308s to it on another origin (a different port is a different origin for fetch).
const mk = async (final) => {
  const hop2 = await listen((req, res) => { if (req.headers.authorization !== AUTH) { res.writeHead(401); res.end(); } else { res.writeHead(final); res.end(); } });
  const hop1 = await listen((req, res) => { res.writeHead(308, { Location: `http://127.0.0.1:${hop2.address().port}/award-entries` }); res.end(); });
  return { hop1, hop2, url: `http://127.0.0.1:${hop1.address().port}/national-show/award-entries` };
};
for (const [final, expect] of [[200, 200], [404, 404]]) {
  const { hop1, hop2, url } = await mk(final);
  const r = await followWithAuth(url, AUTH);
  check(`hop 2 answering ${final} is reported as ${expect} (auth re-sent on hop 2)`, r.status === expect && r.hops === 1, JSON.stringify(r));
  const naive = await fetch(url, { headers: { authorization: AUTH } });
  check(`control: plain fetch redirect:follow is the 401 defect on a cross-origin hop (${naive.status})`, naive.status === 401 || naive.status === final);
  hop1.close(); hop2.close();
}
const T = '/award-entries'; const L = 'Award Entries';
const good = [{ href: '/award-entries', path: T, text: L }, { href: '#main', path: T, text: 'Skip to main content' }];
const g = awardLinkViolations(good, T, L);
check('skip link (#main) is excluded and the real link counts', g.found === 1 && g.bad.length === 0, JSON.stringify(g));
const bad = awardLinkViolations([...good, { href: '/award-entries', path: T, text: 'Exhibitor info' }], T, L);
check('a /award-entries link labelled otherwise fails', bad.bad.length === 1 && bad.bad[0].text === 'Exhibitor info', JSON.stringify(bad));
check('a page with no real link to /award-entries has found=0 (the gate fails on that)', awardLinkViolations([good[1]], T, L).found === 0);

if (failures.length) { console.error(`selftest FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('selftest pass');
