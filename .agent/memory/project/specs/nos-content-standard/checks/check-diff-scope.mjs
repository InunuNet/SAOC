// A3: the diff against origin/main (tracked plus untracked) touches only the files goldens/spec.md "Files the dev may touch" allows.
import { execFileSync } from 'node:child_process';

const ALLOWED = [
  /^components\/nos\/(NosHero|hero-photos|NosSection|NosSubNav|nos-subnav-groups|nos-route-heroes|nos-nav)\.(tsx|ts)$/,
  /^components\/nos-chrome\/nos-nav\.(ts|tsx)$/,
  /^components\/show\/(FaqIndex|ShowFaqList|ShowJumpChips)\.tsx$/,
  /^app\/\(nos\)\/.*\/(page|loading)\.tsx$/,
  /^app\/\(nos\)\/page\.tsx$/,
  /^app\/\(shared\)\/(privacy|terms|refunds)\/.*\.tsx$/,
  /^app\/\(nos\)\/national-show\/nos-(theme|structure)\.css$/,
  /^public\/images\/nos-hero-[A-Za-z0-9-]+\.jpg$/,
  /^lib\/hero-source-widths\.json$/,
  /^lib\/data\/faq-sections\.ts$/,
  /^content\/show-pages\/17-faq\.json$/,
  /^scripts\/(cut-hero-crops\.[a-z]+|seed-show-faq\.ts)$/,
  /^docs\/nos-content-standard\.md$/,
  /^e2e\/[^/]+$/,
  /^\.agent\/memory\/project\/specs\/nos-content-standard\//,
  /^\.agent\/memory\/(scratch|project\/(learned|backlog))/,
  /^comms\.md$/,
  /^test-results\//,
];
const run = (args) => { try { return execFileSync('git', args, { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean); } catch { return null; } };
// The dev branch carries commits that are not the dev's: origin/main, #76 and SAOC's shared API. A file counts as the dev's only when it differs from
// origin/main AND from the #76 tip AND from the pinned SAOC commit (override with NOS_STD_REF76 / NOS_STD_REFSAOC). A file merge-resolved
// between #76 and SAOC would also show; that is rare and the allowed set covers the NOS files either way.
const REFS = ['origin/main', process.env.NOS_STD_REF76 ?? 'feat/nos-pagehero', process.env.NOS_STD_REFSAOC ?? 'b2cff780'];
const sets = REFS.map((r) => run(['diff', '--name-only', r]));
const missing = REFS.filter((_, i) => sets[i] === null);
if (missing.length) { console.error(`nos-content-standard diff scope FAILED: cannot resolve ref(s) ${missing.join(', ')} (git fetch origin; fetch #76)`); process.exit(1); }
const tracked = sets[0].filter((f) => sets.every((st) => st.includes(f)));
const files = [...new Set([...tracked, ...run(['ls-files', '-o', '--exclude-standard'])])];
const outside = files.filter((f) => !ALLOWED.some((re) => re.test(f)));
if (outside.length) { console.error(`nos-content-standard diff scope FAILED: ${outside.length} file(s) outside the allowed set:\n- ${outside.join('\n- ')}`); process.exit(1); }
console.log(`diff scope pass (${files.length} files, all allowed)`);
