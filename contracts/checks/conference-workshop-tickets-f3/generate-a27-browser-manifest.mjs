#!/usr/bin/env node
// F3 (conference-workshop-tickets, M2) — generator for A27's browser_deployed_check
// manifest. Drives a real headless Playwright browser (per .claude/rules/shell-paths.md —
// never Claude-in-Chrome in this project) against /national-show/tickets through the
// real beta Basic-auth wall, confirms a real 2xx render, takes a real screenshot, and
// only THEN writes the manifest.
//
// RETARGETED 2026-10-07 (team-lead decision), TWICE over
// v1 pointed at /tickets (wrong — zero mentions of Symposium there). v2 pointed at
// /national-show/conferences and asserted R2000 visibly with no provisional-badge marker
// — correct content, but team-lead moved that content claim to F6/F7's own contracts,
// where the pricing UI actually ships (confirmed live 2026-10-07: the conferences page's
// JSON payload already carries `"price":2000`, but nothing renders it visibly yet — F6's
// own goal states the visual layer is F7, blocked on the NOS design handoff). v3 (this
// version) targets /national-show/tickets instead — a page F3 itself genuinely affects
// (F3's own excludedDays enforcement governs the Day Pass day picker shown here) — and
// deliberately only proves a 2xx render, the same thin scope as F4's A22, since F3 made
// no UI change of its own (A17) and the native browser_deployed_check kind cannot verify
// page CONTENT regardless (see execution/browser_deployed_check.sh — it checks origin,
// path, commit_sha, timestamp, screenshot presence, and http_status only).
//
// KNOWN BLOCKER THIS SCRIPT DOES NOT TRY TO ROUTE AROUND
// execution/browser_deployed_check.sh's own independent live re-check
// (execution/browser_deployed_check.sh:188) sends a bare unauthenticated curl, and
// proxy.ts gates every path on beta.saoc.co.za behind Basic Auth except 6 webhook paths
// — so that re-check will see 401 and FAIL regardless of how correct this manifest is,
// until InunuNet/Athanor#1459 lands upstream or the wall gets a scoped verifier
// exemption. See .agent/memory/project/backlog.md (2026-10-07 entry). Filed, not routed
// around, per .claude/rules/athanor.md. Same blocker annotated on F4's A22 and F6's A24.
//
// Usage: node contracts/checks/conference-workshop-tickets-f3/generate-a27-browser-manifest.mjs [origin]
// Exit 0 = manifest written (render verified real), 1 = render verification failed
// (no manifest written), 2 = usage/setup error (missing credentials, missing playwright).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');
const PATH_TESTED = '/national-show/tickets';
const MANIFEST_DIR = path.join(
  REPO_ROOT,
  '.agent/memory/project/specs/conference-workshop-tickets/goldens/fixtures',
);
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'f3-a27-browser-manifest-tickets-smoke.json');
const SCREENSHOT_REL = 'fixtures/f3-a27-tickets-smoke-screenshot.png';
const SCREENSHOT_PATH = path.join(MANIFEST_DIR, 'f3-a27-tickets-smoke-screenshot.png');

function usageError(message) {
  console.error(`usage error: ${message}`);
  process.exit(2);
}

function readEnvLocalValue(key) {
  const envPath = path.join(REPO_ROOT, '.env.local');
  if (!existsSync(envPath)) return undefined;
  const contents = readFileSync(envPath, 'utf8');
  for (const line of contents.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && match[1] === key) return match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return undefined;
}

function resolveCredential(envVarName) {
  return process.env[envVarName] ?? readEnvLocalValue(envVarName);
}

async function main() {
  const origin = (process.argv[2] ?? 'https://beta.saoc.co.za').replace(/\/$/, '');
  const username = resolveCredential('BETA_BASIC_AUTH_USER');
  const password = resolveCredential('BETA_BASIC_AUTH_PASSWORD');
  if (!username || !password) {
    usageError('BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD not found in the environment or .env.local');
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    usageError('playwright not installed — run pnpm install');
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ httpCredentials: { username, password } });
    const page = await context.newPage();
    const response = await page.goto(`${origin}${PATH_TESTED}`, { waitUntil: 'networkidle' });
    const httpStatus = response?.status() ?? 0;

    if (httpStatus < 200 || httpStatus > 299) {
      console.error(`FAIL: generate-a27-browser-manifest.mjs — page returned HTTP ${httpStatus}, expected 2xx, no manifest written`);
      process.exit(1);
    }

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

    const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    const manifest = {
      origin,
      path_tested: PATH_TESTED,
      screenshot_path: SCREENSHOT_REL,
      commit_sha: commitSha,
      timestamp: new Date().toISOString(),
      http_status: httpStatus,
      outcome: 'pass',
      notes:
        'A27: /national-show/tickets renders 2xx post-F3 (thin smoke check only — the R2000/provisional-marker content ' +
        'claim moved to F6/F7, where that UI ships). NOTE: execution/browser_deployed_check.sh verification of this ' +
        'manifest will still FAIL independently of this render proof — its own live re-check sends no Basic Auth header ' +
        'and the beta wall gates this path 401 — tracked as InunuNet/Athanor#1459. See this script\'s header comment and ' +
        '.agent/memory/project/backlog.md (2026-10-07 entry).',
    };
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`PASS: render verified, manifest written to ${MANIFEST_PATH}`);
    console.log('Reminder: execution/browser_deployed_check.sh will still reject this manifest live until InunuNet/Athanor#1459 lands.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(2);
});
