// F9-A2 - the launch-safety slice of withholdPlaceholderProse (run with cwd = the implementation tree).
const mod = await import(`${process.cwd()}/lib/data/show-pages.ts`).catch((e: unknown) => {
  console.error(`INFRA: import failed: ${String(e)}`);
  process.exit(2);
});
type Env = Record<string, string | undefined>;
const withhold = (mod as { withholdPlaceholderProse: (env: Env) => boolean }).withholdPlaceholderProse;
if (typeof withhold !== 'function') {
  console.error('FAIL: lib/data/show-pages.ts must export withholdPlaceholderProse');
  process.exit(1);
}

const wall = { BETA_BASIC_AUTH_USER: 'u', BETA_BASIC_AUTH_PASSWORD: 'p' };
const cases: Array<[string, Env, boolean]> = [
  ['launch true, preview on, wall up -> withhold', { SHOW_PLACEHOLDER_PREVIEW: 'true', SITE_PUBLIC_LAUNCH: 'true', ...wall }, true],
  ['launch true, preview on, no wall -> withhold', { SHOW_PLACEHOLDER_PREVIEW: 'true', SITE_PUBLIC_LAUNCH: 'true' }, true],
  ['launch off, preview on, no wall -> withhold', { SHOW_PLACEHOLDER_PREVIEW: 'true' }, true],
  ['launch off, preview off, wall up -> withhold', { ...wall }, true],
  ['launch off, preview on, wall up -> release', { SHOW_PLACEHOLDER_PREVIEW: 'true', ...wall }, false],
];
const problems = cases
  .filter(([, env, expected]) => withhold(env) !== expected)
  .map(([name, , expected]) => `${name}: expected ${expected}`);
if (problems.length) {
  for (const p of problems) console.error(`FAIL: ${p}`);
  process.exit(1);
}
console.log(`PASS: ${cases.length} withhold cases hold`);
