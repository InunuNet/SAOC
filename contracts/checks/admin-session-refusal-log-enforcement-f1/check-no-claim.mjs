// A1 — freshly signed-up account with NO custom claims at all (admin absent). Isolates
// classifyRefusal's first ternary branch: `decoded.admin !== true` → 'no-claim'. See
// contracts/golden/admin-session-refusal-log-enforcement-f1/README.md "Refusal cases
// chosen and why".

import {
  assertAccountGone,
  deleteAccountByIdToken,
  postSession,
  randomProbeEmail,
  refusalLogMatches,
  runCheck,
  signUpProbeAccount,
  startServer,
  stopServer,
} from './_shared.mjs';

await runCheck('admin-session-refusal-log-enforcement-f1 — A1 (no-claim)', async (reporter) => {
  const email = randomProbeEmail('no-claim');
  let account;
  let server;
  try {
    server = await startServer();
    account = await signUpProbeAccount(email);

    const mark = server.buffer.mark();
    const response = await postSession(account.idToken, server.baseUrl);
    const logSince = server.buffer.since(mark);

    reporter.check(response.status === 403, 'HTTP response is 403', `got ${response.status}`);
    reporter.check(
      JSON.stringify(response.json) === JSON.stringify({ error: 'Forbidden' }),
      'response body is exactly { error: "Forbidden" }, no leaked reason/email',
      `got ${response.rawBody}`,
    );
    reporter.check(
      refusalLogMatches(logSince, 'no-claim', email),
      "captured server log contains '[admin-auth] refused' with reason 'no-claim' and this probe's email",
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
});
