// A3: the diff against origin/main (tracked plus untracked) touches only the files goldens/spec.md "Files the dev may touch" allows.
import { execFileSync } from 'node:child_process';

const ALLOWED = [
  /^components\/nos\/(NosHero|hero-photos|NosSection|NosSubNav|nos-subnav-groups|nos-route-heroes|nos-nav)\.(tsx|ts)$/,
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
const run = (args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
const files = [...new Set([...run(['diff', '--name-only', 'origin/main']), ...run(['ls-files', '-o', '--exclude-standard'])])];
// components/ui/** and lib/hero-facts.ts are SAOC-owned: any change there is a failure (A2 diffs them against the pinned b2cff780). Needs an API change? Request it from SAOC.
const outside = files.filter((f) => !ALLOWED.some((re) => re.test(f)));
if (outside.length) { console.error(`nos-content-standard diff scope FAILED: ${outside.length} file(s) outside the allowed set:\n- ${outside.join('\n- ')}`); process.exit(1); }
console.log(`diff scope pass (${files.length} files, all allowed)`);
