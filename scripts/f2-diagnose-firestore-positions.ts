/**
 * F2 (ticketing-complete, M1) — READ-ONLY diagnostic, not part of the migration. Answers a
 * question raised in QA (2026-09-08): do any REAL Firestore `tickets` positions exist
 * against the three SKUs `scripts/migrate-f2-ticket-taxonomy.ts` plans to retire
 * (`active: false`) — `field-trip-single`, `field-trip-all-outings`, and
 * `early-bird-weekend-pass`? Retirement never deletes the Sanity document either way, so
 * this does not change the write-safety verdict — but if real people hold paid positions
 * against a SKU whose price the taxonomy no longer offers, that is a refund/communication
 * decision only Brad can make, and only if he knows before `--apply` runs.
 *
 * Also re-checks the "1 real position" figure quoted for `early-bird-weekend-pass`
 * throughout this feature's design record — that number came from an earlier research pass
 * and had not been re-verified since. A repeated-but-unverified number is exactly the
 * failure mode this diagnostic exists to close.
 *
 * ONLY Firestore READS (`.get()`/`.where()`) are used below. No `.set()`, `.update()`,
 * `.delete()`, `.create()`, and no Sanity client at all — this script never touches Sanity.
 *
 * Reports, per slug: total position count, a breakdown by status (reserved / paid /
 * cancelled / checked-in / refunded — a stranded expired `reserved` position is NOT the
 * same as a real sale), and the total `amount` summed only across `paid`/`checked-in`
 * positions (the closest proxy this schema has to "genuinely sold").
 *
 * Run with: node --import tsx/esm scripts/f2-diagnose-firestore-positions.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function normalizeLineEndings(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Same hand-written, multi-line-aware .env.local parser as
 * scripts/scan-firestore-residue.ts's readEnvLocal() — reused verbatim rather than the
 * naive single-line splitter this project's Sanity-facing scripts use, because
 * FIREBASE_ADMIN_PRIVATE_KEY is a quoted PEM block that can legitimately contain real
 * embedded newlines before its closing quote; a naive splitter truncates the key at its
 * first line and corrupts the credential (confirmed here — the naive version threw
 * "Failed to parse private key" against this exact file).
 */
function readEnvLocal(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return {};
  const raw = readFileSync(envPath, 'utf8');
  const lines = normalizeLineEndings(raw).split('\n');
  const out: Record<string, string> = {};

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) {
      i += 1;
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      i += 1;
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const valuePart = trimmed.slice(eq + 1).trim();
    const quoteChar = valuePart.startsWith('"') || valuePart.startsWith("'") ? valuePart[0] : undefined;
    i += 1;

    if (!quoteChar) {
      out[key] = valuePart;
      continue;
    }

    const body = valuePart.slice(1);
    if (body.endsWith(quoteChar)) {
      out[key] = body.slice(0, -1);
      continue;
    }

    const segments = [body];
    let closed = false;
    while (i < lines.length) {
      const nextLine = lines[i];
      i += 1;
      if (nextLine.endsWith(quoteChar)) {
        segments.push(nextLine.slice(0, -1));
        closed = true;
        break;
      }
      segments.push(nextLine);
    }
    if (!closed) {
      throw new Error(
        `.env.local: unterminated quoted value for ${key} — no closing ${quoteChar} found before EOF.`
      );
    }
    out[key] = segments.join('\n');
  }
  return out;
}

function initAdminFromEnvLocal(): App {
  if (getApps().length > 0) return getApps()[0];

  const env = readEnvLocal();
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials in .env.local: FIREBASE_ADMIN_PROJECT_ID, ' +
        'FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY'
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const RETIRED_SLUGS = ['field-trip-single', 'field-trip-all-outings', 'early-bird-weekend-pass'];

const SOLD_STATUSES = new Set(['paid', 'checked-in']);

interface SlugReport {
  slug: string;
  totalPositions: number;
  byStatus: Record<string, number>;
  soldPositionsAmount: number;
}

async function reportForSlug(
  db: FirebaseFirestore.Firestore,
  slug: string
): Promise<SlugReport> {
  // Read-only: .where().get() only.
  const snapshot = await db.collection('tickets').where('ticketType', '==', slug).get();

  const byStatus: Record<string, number> = {};
  let soldPositionsAmount = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const status = String(data['status'] ?? 'unknown');
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (SOLD_STATUSES.has(status)) {
      const amount = typeof data['amount'] === 'number' ? data['amount'] : 0;
      soldPositionsAmount += amount;
    }
  });

  return {
    slug,
    totalPositions: snapshot.size,
    byStatus,
    soldPositionsAmount,
  };
}

async function main(): Promise<void> {
  const app = initAdminFromEnvLocal();
  const db = getFirestore(app);
  const projectId = app.options.credential ? '(from .env.local FIREBASE_ADMIN_PROJECT_ID)' : 'unknown';

  console.log(
    `Diagnosing Firestore 'tickets' positions for retired-SKU slugs (READ-ONLY) — project ${projectId}`
  );
  console.log('  Environment queried: live Firestore, same project the app reads at runtime.');
  console.log('  No writes issued — only .where().get() calls.');
  console.log('');

  for (const slug of RETIRED_SLUGS) {
    const report = await reportForSlug(db, slug);
    console.log(`  ${report.slug}:`);
    console.log(`    total positions: ${report.totalPositions}`);
    console.log(`    by status: ${JSON.stringify(report.byStatus)}`);
    console.log(
      `    sum of 'amount' across paid/checked-in positions only: R${report.soldPositionsAmount}`
    );
  }

  console.log('');
  console.log('Diagnosis complete. No documents were written.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
