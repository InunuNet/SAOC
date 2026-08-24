// A4 — the converse of A1-A3. A genuinely eligible account (admin:true,
// emailVerified:true, AND actually present on ADMIN_EMAIL_ALLOWLIST for this one
// check's spawned server only, via extraEnv on startServer — never .env.local on disk)
// succeeds and produces ZERO '[admin-auth] refused' log lines. Without this, a
// classifyRefusal that logged unconditionally on every request (success or failure)
// would pass A1-A3 by coincidence. See
// contracts/golden/admin-session-refusal-log-enforcement-f1/README.md.

import {
  assertAccountGone,
  countRefusalLines,
  deleteAccountByIdToken,
  loadEnvOrFail,
  mintIdTokenForUid,
  postSession,
  randomProbeEmail,
  runCheck,
  setCustomClaims,
  setEmailVerified,
  signUpProbeAccount,
  startServer,
  stopServer,
} from './_shared.mjs';

await runCheck(
  'admin-session-refusal-log-enforcement-f1 — A4 (eligible, no leak)',
  async (reporter) => {
    const email = randomProbeEmail('eligible');
    let account;
    let server;
    try {
      // Provisioning must precede spawning the server: the allowlist entry is baked
      // into the child process's env at spawn time, and this probe's email must exist
      // in that value.
      const baseAllowlist = loadEnvOrFail('ADMIN_EMAIL_ALLOWLIST');
      server = await startServer({ ADMIN_EMAIL_ALLOWLIST: `${baseAllowlist},${email}` });

      account = await signUpProbeAccount(email);
      await setCustomClaims(account.localId, { admin: true });
      await setEmailVerified(account.localId, true);
      const idToken = await mintIdTokenForUid(account.localId);
      account.idToken = idToken;

      const mark = server.buffer.mark();
      const response = await postSession(idToken, server.baseUrl);
      const logSince = server.buffer.since(mark);

      reporter.check(response.status === 200, 'HTTP response is 200', `got ${response.status}`);
      reporter.check(
        response.setCookieHeaderPresent,
        'response sets a session cookie',
      );
      reporter.check(
        countRefusalLines(logSince) === 0,
        "captured server log contains ZERO '[admin-auth] refused' lines for this request",
        logSince.length > 0 ? logSince.slice(0, 500) : '(no output captured for this request)',
      );
    } finally {
      try {
        if (account) {
          await deleteAccountByIdToken(account.idToken);
          await assertAccountGone(account.idToken);
        }
      } finally {
        if (server) {
          await stopServer(server);
          reporter.check(
            server.exited(),
            'spawned server process has actually exited (observed exit, not just signal sent)',
          );
        }
      }
    }
  },
);
