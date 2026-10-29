// check-live: verify-landing against the real served hub (A4). Needs a production build made by the nos-content-standard build.sh
// (it bakes the gate port and replays the captured Sanity fixture, so nothing here touches the Sanity API or writes anything).
//   node check-live.mjs --html <file>   verify a saved page (also how a QA reproduces a failure)
//   node check-live.mjs                 start `next start` twice (beta preview on, then off), fetch the hub from each, verify, kill by exact PID
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { withBaseline } from './baseline.mjs';
import { COPY, verify } from './verify-landing.mjs';

const copy = withBaseline(COPY);
const htmlArg = process.argv.indexOf('--html');
let bad = 0;
const report = (label, failures) => {
  for (const x of failures) console.error(`FAIL [${label}] ${x}`);
  if (failures.length) bad += 1;
  console.log(`check-live [${label}]: ${failures.length ? `${failures.length} failure(s)` : 'ok'}`);
};

if (htmlArg !== -1) {
  report('file', verify(readFileSync(process.argv[htmlArg + 1], 'utf8'), copy));
} else {
  const { AUTH, startServer, waitReady } = await import('../../nos-content-standard/checks/_lib.mjs');
  const BOX = '.tmp/sandbox/nos-landing-v1-gate';
  mkdirSync(BOX, { recursive: true });
  for (const [offset, preview] of [[1, true], [2, false]]) {
    const server = startServer(offset, { preview });
    writeFileSync(`${BOX}/server-${server.port}.pid`, String(server.proc.pid));
    try {
      await waitReady(server);
      const res = await fetch(`${server.nos}/`, { headers: { authorization: AUTH } });
      const html = await res.text();
      writeFileSync(`${BOX}/hub-${preview ? 'preview' : 'plain'}.html`, html);
      if (res.status !== 200) report(preview ? 'preview' : 'plain', [`hub answered ${res.status}`]);
      else report(preview ? 'preview' : 'plain', verify(html, copy));
    } finally {
      server.proc.kill(); // the exact child this gate spawned; never pkill, never by name
    }
  }
}
process.exit(bad ? 1 : 0);
