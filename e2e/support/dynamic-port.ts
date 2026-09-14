// =============================================================
// SAOC — e2e/support/dynamic-port.ts
// Mission ticketing-complete M1/F7 — dynamic port discovery for the Playwright
// harness. Several stale dev servers were running on assorted other ports when
// this was written, and nothing was listening on the port `dev:secure` names — a
// hardcoded port in a test harness is a flaky test waiting to happen: it can
// silently talk to a STALE server's old state, or fail outright when nothing is
// listening. getFreeLocalPort() asks the OS for a genuinely free port instead of
// guessing one, by binding to port 0 (the OS picks) and reading the assignment back.
// No new dependency — `net` is a Node builtin.
// =============================================================
import * as net from 'net';

/**
 * Opens a throwaway TCP server on port 0 (OS-assigned), reads back whichever port
 * the OS handed out, closes the probe server, and resolves with that port number.
 * Callers must use the returned port immediately — nothing prevents another process
 * from claiming it in the (small) window between this resolving and the real server
 * binding to it, but that window is the same one every "find a free port" strategy
 * accepts, and it is far safer than a fixed literal.
 */
export function getFreeLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once('error', (err) => {
      reject(err);
    });

    probe.listen(0, () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') {
        probe.close();
        reject(new Error('getFreeLocalPort: OS did not return a usable address'));
        return;
      }
      const { port } = address;
      probe.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(port);
      });
    });
  });
}
