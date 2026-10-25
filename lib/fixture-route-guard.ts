// One rule for every render-check fixture route (/media-kit-fixtures, /ticket-fixtures/buy,
// /admin-fixtures/[route]): such a route must never render on the deployed site, even if its env flag
// were set there. Firebase App Hosting runs on Cloud Run, which sets K_SERVICE. NODE_ENV cannot be the
// test: it is 'production' under the local `next start` the render checks use, and K_SERVICE is unset
// there, so the fixtures still work locally. Each route keeps its own flag test beside this one.
export function isHostedRuntime(): boolean {
  return Boolean(process.env.K_SERVICE);
}
