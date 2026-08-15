// admin-auth-f4-google — shared helpers. Reuses F1/F2's + F3's helpers directly rather than
// duplicating them — same target server, same env loading, same fixture conventions, same
// runScript() child-process pattern for exercising scripts/admin-grant.ts for real.

export {
  BASE_URL,
  loadEnvOrFail,
  postSession,
  getAdminPage,
  getTicketsApi,
  warmUp,
  runCheck,
  PreconditionError,
} from '../admin-auth-hardening/_shared.mjs';

export {
  runScript,
  readUserByEmail,
  deleteUserIfExists,
  createPreExistingUnverifiedFixture,
  randomPreExistingFixtureEmail,
} from '../admin-auth-f3-provisioning/_shared.mjs';
