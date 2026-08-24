// A3 — admin:true AND emailVerified:true, but the email is a randomly generated
// @saoc-contract-check.invalid address certain not to be on ADMIN_EMAIL_ALLOWLIST.
// Isolates classifyRefusal's third branch (implicit else) → 'not-allowlisted'. See
// contracts/golden/admin-session-refusal-log-enforcement-f1/README.md "Refusal cases
// chosen and why".

import {
  assertAccountGone,
  deleteAccountByIdToken,
  mintIdTokenForUid,
  postSession,
  randomProbeEmail,
  refusalLogMatches,
  runCheck,
  setCustomClaims,
  setEmailVerified,
  signUpProbeAccount,
  startServer,
  stopServer,
} from './_shared.mjs';

await runCheck(
  'admin-session-refusal-log-enforcement-f1 — A3 (not-allowlisted)',
  async (reporter) => {
    const email = randomProbeEmail('not-allowlisted');
    let account;
    let server;
    try {
      server = await startServer();
      account = await signUpProbeAccount(email);
      await setCustomClaims(account.localId, { admin: true });
      await setEmailVerified(account.localId, true);
      // Fresh idToken required after mutating claims/verification state.
      const idToken = await mintIdTokenForUid(account.localId);
      account.idToken = idToken;

      const mark = server.buffer.mark();
      const response = await postSession(idToken, server.baseUrl);
      const logSince = server.buffer.since(mark);

      reporter.check(response.status === 403, 'HTTP response is 403', `got ${response.status}`);
      reporter.check(
        JSON.stringify(response.json) === JSON.stringify({ error: 'Forbidden' }),
        'response body is exactly { error: "Forbidden" }, no leaked reason/email',
        `got ${response.rawBody}`,
      );
      reporter.check(
        refusalLogMatches(logSince, 'not-allowlisted', email),
        "captured server log contains '[admin-auth] refused' with reason 'not-allowlisted' and this probe's email",
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
        }
      }
    }
  },
);
