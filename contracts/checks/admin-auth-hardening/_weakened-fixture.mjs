// Negative-control fixture: a tiny standalone HTTP server that intentionally
// reproduces the PRE-FIX behaviour of POST /api/admin/session — mints a session-shaped
// cookie for ANY syntactically valid idToken, with no claim check and no allowlist
// check at all. This is the exact defect measured in the 2026-08-14 baseline.
//
// Used ONLY by check-negative-control.mjs, to prove that check's own probe-and-assert
// logic is capable of reporting FAILURE, not just success. It never touches the real
// dev server and is not itself part of the product — do not import this from anywhere
// outside this contract's checks.

import { createServer } from 'node:http';

export function startWeakenedFixture(port) {
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/admin/session') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        // The defect: any idToken-shaped string mints a cookie. No verifyIdToken, no
        // isAdminToken, no allowlist.
        res.setHeader('Set-Cookie', 'session=weakened-fixture-cookie; HttpOnly; Path=/');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}
