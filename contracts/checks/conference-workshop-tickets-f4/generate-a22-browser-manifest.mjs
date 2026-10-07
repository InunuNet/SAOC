#!/usr/bin/env node
// F4 (conference-workshop-tickets, M2) — generator for A22's browser_deployed_check
// manifest. Drives a real headless Playwright browser (per .claude/rules/shell-paths.md —
// never Claude-in-Chrome in this project) against /national-show/tickets/buy through the
// real beta Basic-auth wall, confirms a real 2xx render, takes a real screenshot, and only
// THEN writes the manifest. Mirrors F3's generate-a27-browser-manifest.mjs exactly (same
// credential-resolution, same thin 2xx-only scope, same known-blocker posture).
//
// WHY /national-show/tickets (same path as F3's A27, retargeted here deliberately):
// /national-show/tickets/buy is the page that most directly exercises F4's engine
// (effectiveCapacity(), planPooledCapacity(), resolveEffectivePrice() from
// lib/checkout-reservation.ts) but is uncommitted as of this run (git status: `??
// app/(marketing)/national-show/tickets/buy/`) — Firebase App Hosting deploys from git, so
// it 404s live and cannot be smoke-tested against beta yet. /national-show/tickets (this
// script's actual target) is the already-deployed overview page, and it too calls into F4's
// engine directly — `import { resolveEffectivePrice } from '@/lib/checkout-reservation'`
// (app/(marketing)/national-show/tickets/page.tsx:8, used at line 99) — so it is a genuine,
// live-renderable F4 surface, not a stand-in. Re-point this script at /tickets/buy once that
// route is committed and deployed.
//
// KNOWN BLOCKER THIS SCRIPT DOES NOT TRY TO ROUTE AROUND
// execution/browser_deployed_check.sh's own independent live re-check
// (execution/browser_deployed_check.sh:188) sends a bare unauthenticated curl, and
// proxy.ts gates every path on beta.saoc.co.za behind Basic Auth except 6 webhook paths —
// so that re-check will see 401 and FAIL regardless of how correct this manifest is, until
// InunuNet/Athanor#1459 lands upstream or the wall gets a scoped verifier exemption. See
// .agent/memory/project/backlog.md (2026-10-07 entry). Filed, not routed around, per
// .claude/rules/athanor.md. Same blocker annotated on F3's A27 and F6's A24.
//
// Usage: node contracts/checks/conference-workshop-tickets-f4/generate-a22-browser-manifest.mjs [origin]
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
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'f4-a22-browser-manifest-tickets-smoke.json');
const SCREENSHOT_REL = 'fixtures/f4-a22-tickets-smoke-screenshot.png';
const SCREENSHOT_PATH = path.join(MANIFEST_DIR, 'f4-a22-tickets-smoke-screenshot.png');

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
      console.error(`FAIL: generate-a22-browser-manifest.mjs — page returned HTTP ${httpStatus}, expected 2xx, no manifest written`);
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
        'A22: /national-show/tickets renders 2xx post-F4 (thin smoke check only — this page directly calls F4\'s ' +
        'resolveEffectivePrice() from lib/checkout-reservation.ts to render its day-qualified pricing; /tickets/buy ' +
        'exercises more of the engine but is uncommitted as of this run and 404s live — see header comment). NOTE: ' +
        'execution/browser_deployed_check.sh verification of this manifest will still FAIL independently of this render ' +
        'proof — its own live re-check sends no Basic Auth header and the beta wall gates this path 401 — tracked as ' +
        'InunuNet/Athanor#1459. See this script\'s header comment and .agent/memory/project/backlog.md (2026-10-07 entry).',
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
