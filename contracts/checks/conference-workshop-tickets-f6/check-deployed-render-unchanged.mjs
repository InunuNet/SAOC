// F6 (conference-workshop-tickets, M4) — A20 (kind: browser_deployed_check): BrowserAgent
// confirmed, against the REAL deployed beta.saoc.co.za origin (never a *.hosted.app/
// *.run.app host — per docs/verification-triad-gate.md's own denylist), that all three
// wired pages (symposium, wosa-conference, workshops) render IDENTICALLY to before this
// feature — the additive loader wiring (§3) is inert, exactly as A9/A10/A11's own static
// diff proofs require.
//
// Same relay convention as F4's check-confirmation-email-sent.mjs (A16, gws_inbox_check):
// this script does not drive a browser itself — that's necessarily a live,
// human-or-agent-initiated step (Layer 2 of the verification triad) — it locates one
// manifest PER wired page and relays execution/browser_deployed_check.sh's own verdict for
// each, failing loudly with instructions when any manifest is missing. A single-manifest
// shortcut would leave two of the three pages unverified; this script requires all three.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');
const browserScript = path.join(REPO_ROOT, 'execution/browser_deployed_check.sh');

const DENYLISTED_ORIGIN_PATTERNS = [/\.hosted\.app$/, /\.run\.app$/];
const origin = (process.argv[2] ?? 'https://beta.saoc.co.za').replace(/\/$/, '');
const originHost = origin.replace(/^https?:\/\//, '');
if (DENYLISTED_ORIGIN_PATTERNS.some((p) => p.test(originHost))) {
  console.error('FAIL: check-deployed-render-unchanged.mjs');
  console.error(`  - origin ${origin} matches a denylisted pattern (*.hosted.app / *.run.app) — must be the real deployed beta.saoc.co.za origin`);
  process.exit(1);
}

const PAGES = [
  {
    label: 'symposium',
    pathTested: '/national-show/symposium',
    manifestRelPath: '.agent/memory/project/specs/conference-workshop-tickets/goldens/fixtures/f6-a20-browser-manifest-symposium.json',
  },
  {
    label: 'wosa-conference',
    pathTested: '/national-show/wosa-conference',
    manifestRelPath: '.agent/memory/project/specs/conference-workshop-tickets/goldens/fixtures/f6-a20-browser-manifest-wosa-conference.json',
  },
  {
    label: 'workshops',
    pathTested: '/national-show/workshops',
    manifestRelPath: '.agent/memory/project/specs/conference-workshop-tickets/goldens/fixtures/f6-a20-browser-manifest-workshops.json',
  },
];

if (!existsSync(browserScript)) {
  console.error('FAIL: check-deployed-render-unchanged.mjs');
  console.error(`  - execution/browser_deployed_check.sh not found at ${browserScript} — harness file missing or moved`);
  process.exit(1);
}

const failures = [];
for (const page of PAGES) {
  const manifestPath = path.join(REPO_ROOT, page.manifestRelPath);
  if (!existsSync(manifestPath)) {
    failures.push(
      `${page.label}: no manifest at ${page.manifestRelPath} — this assertion requires a REAL BrowserAgent pass against ` +
        `${origin}${page.pathTested} (pre- and post-wiring, or against this exact deployed commit, confirming the rendered ` +
        'output matches the pre-feature baseline) recorded in the manifest shape ' +
        'docs/verification-triad-gate.md describes (origin, path_tested, screenshot_path, commit_sha, timestamp, http_status)',
    );
    continue;
  }
  try {
    const output = execFileSync('bash', [browserScript, manifestPath], { encoding: 'utf8' });
    process.stdout.write(output);
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    failures.push(`${page.label}: execution/browser_deployed_check.sh rejected ${page.manifestRelPath} (exit ${error.status})`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-deployed-render-unchanged.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`PASS: execution/browser_deployed_check.sh verified all three wired pages against ${origin} — render unchanged from before this feature.`);
