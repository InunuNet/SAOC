#!/usr/bin/env node
// F3 (conference-workshop-tickets, M2) — generator for A27's browser_deployed_check
// manifest. Drives a real headless Playwright browser (per .claude/rules/shell-paths.md —
// never Claude-in-Chrome in this project) against /national-show/conferences through the
// real beta Basic-auth wall, verifies the actual rendered content, takes a real
// screenshot, and only THEN writes the manifest — a manifest is never written for a page
// that didn't actually show what it claims.
//
// WHY /national-show/conferences, NOT /tickets (team-lead correction, 2026-10-07)
// /tickets has zero mentions of "Symposium" — confirmed live. /national-show/conferences
// is the real page: live content shows exactly two cards, slugs `saoc-symposium` and
// `wosa-conference`, each rendering the visible text "R2000.00" immediately before its
// own `id="ticket-type-qty-<slug>-desc"` element, and the page contains ZERO occurrences
// of `data-testid="provisional-badge"` (TicketTypeCard's own visible marker attribute —
// see components/tickets/TicketTypeCard.tsx:108) anywhere. A page-wide absence check for
// that marker is safe ONLY on this page, because it renders nothing but these two cards —
// /tickets legitimately shows a "Provisional pricing" badge on Lee-Ann-sheet admission
// products and must never be asserted marker-free.
//
// KNOWN BLOCKER THIS SCRIPT DOES NOT TRY TO ROUTE AROUND
// This script can produce a well-formed, honestly-verified manifest, but
// execution/browser_deployed_check.sh's own independent live re-check
// (execution/browser_deployed_check.sh:188) sends a bare unauthenticated curl, and
// proxy.ts gates every path on beta.saoc.co.za behind Basic Auth except 6 webhook paths
// — so that re-check will see 401 and FAIL regardless of how correct this manifest is,
// until the harness gap is fixed upstream or the wall gets a scoped verifier exemption.
// See .agent/memory/project/backlog.md (2026-10-07 entry) and
// .agent/memory/scratch/triad-kind-field-bug.md's sibling note. Filed, not routed around,
// per .claude/rules/athanor.md.
//
// Usage: node contracts/checks/conference-workshop-tickets-f3/generate-a27-browser-manifest.mjs [origin]
// Exit 0 = manifest written (content verified real), 1 = content verification failed
// (no manifest written), 2 = usage/setup error (missing credentials, missing playwright).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');
const PATH_TESTED = '/national-show/conferences';
const MANIFEST_DIR = path.join(
  REPO_ROOT,
  '.agent/memory/project/specs/conference-workshop-tickets/goldens/fixtures',
);
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'f3-a27-browser-manifest-conferences-pricing.json');
const SCREENSHOT_REL = 'fixtures/f3-a27-screenshot.png';
const SCREENSHOT_PATH = path.join(MANIFEST_DIR, 'f3-a27-screenshot.png');

const EXPECTED_CARDS = [
  { slug: 'saoc-symposium', priceText: 'R2000.00' },
  { slug: 'wosa-conference', priceText: 'R2000.00' },
];

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
    const bodyText = await page.content();

    const failures = [];
    if (httpStatus < 200 || httpStatus > 299) {
      failures.push(`page returned HTTP ${httpStatus}, expected 2xx`);
    }
    for (const card of EXPECTED_CARDS) {
      const descAnchor = `id="ticket-type-qty-${card.slug}-desc"`;
      if (!bodyText.includes(descAnchor)) {
        failures.push(`card for slug '${card.slug}' not found on the page (no ${descAnchor})`);
        continue;
      }
      const anchorIndex = bodyText.indexOf(descAnchor);
      const precedingWindow = bodyText.slice(Math.max(0, anchorIndex - 200), anchorIndex);
      if (!precedingWindow.includes(card.priceText)) {
        failures.push(
          `card '${card.slug}' does not show '${card.priceText}' immediately before ${descAnchor} — found: ${JSON.stringify(precedingWindow.slice(-120))}`,
        );
      }
    }
    if (bodyText.includes('data-testid="provisional-badge"')) {
      failures.push(
        'page-wide check found data-testid="provisional-badge" on /national-show/conferences — this page must render ' +
          'ONLY the two conference cards with provisional:false; a page-wide absence check is safe here specifically ' +
          'because of that (never on /tickets, which legitimately shows the badge on admission products)',
      );
    }

    if (failures.length > 0) {
      console.error('FAIL: generate-a27-browser-manifest.mjs — content verification failed, no manifest written');
      for (const f of failures) console.error(`  - ${f}`);
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
        'A27: both saoc-symposium and wosa-conference render R2000.00 with no provisional-badge marker on /national-show/conferences. ' +
        'NOTE: execution/browser_deployed_check.sh verification of this manifest will still FAIL independently of this content proof ' +
        '— its own live re-check sends no Basic Auth header and the beta wall gates this path 401 — see this script\'s header comment ' +
        'and .agent/memory/project/backlog.md (2026-10-07 entry).',
    };
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`PASS: content verified, manifest written to ${MANIFEST_PATH}`);
    console.log('Reminder: execution/browser_deployed_check.sh will still reject this manifest live until the auth-wall harness gap is resolved.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(2);
});
