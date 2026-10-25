/**
 * True when running on the hosted platform. Firebase App Hosting runs on Cloud Run, which always
 * sets K_SERVICE; a local `next dev` / `next start` never does.
 */
export function isHostedRuntime(env: Readonly<Record<string, string | undefined>>): boolean {
  return Boolean(env['K_SERVICE']);
}
