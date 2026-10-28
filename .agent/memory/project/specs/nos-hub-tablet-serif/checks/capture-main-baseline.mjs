// Main baseline for the unchanged-header proof. Usage: node capture-main-baseline.mjs (after capture-main-baseline.sh has built the base ref under
// .tmp/sandbox/hub-main-baseline). Starts that build on fixture replay on its own port, captures the header strips, kills the exact child it started.
import { launchChromium, startServer, waitReady, fixtureProof, collector, VALUES, EVIDENCE_DIR, ROOT } from './_lib.mjs';
import { captureHeaderStrips } from './capture-header.mjs';

const B = VALUES.hub.header.baseline;
const c = collector('main header baseline');
const server = startServer(B.portOffset, { root: `${ROOT}/${B.dir}` });
try {
  await waitReady(server);
  const browser = await launchChromium();
  try {
    const files = await captureHeaderStrips(server, browser, `${EVIDENCE_DIR}/${B.shotsDir.replace(/^evidence\//, '')}`);
    c.note(`note: captured ${files.length} main header strip(s)`);
  } finally { await browser.close(); }
  fixtureProof(server, c);
} catch (e) { c.fail(e); console.error(e); }
c.finish(server);
