// A2 — admin:true claim set, but emailVerified stays false (the default post-signup
// state, never flipped). Isolates classifyRefusal's second ternary branch:
// `decoded.email_verified !== true` → 'email-unverified'. See
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
  signUpProbeAccount,
  startServer,
  stopServer,
} from './_shared.mjs';

await runCheck(
  'admin-session-refusal-log-enforcement-f1 — A2 (email-unverified)',
  async (reporter) => {
    const email = randomProbeEmail('email-unverified');
    let account;
    let server;
    try {
      server = await startServer();
      account = await signUpProbeAccount(email);
      await setCustomClaims(account.localId, { admin: true });
      // Fresh idToken required after mutating claims — Firebase embeds claims at mint
      // time, not per-request. emailVerified is left at its default false.
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
        refusalLogMatches(logSince, 'email-unverified', email),
        "captured server log contains '[admin-auth] refused' with reason 'email-unverified' and this probe's email",
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
