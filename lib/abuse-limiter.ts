import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

import { trustedClientIpFromForwardedFor } from './client-ip';

/**
 * Durable, cross-instance abuse limiter backed by Firestore (SEC-15, and the limiter half of
 * SEC-02). Sliding log, one document per (scope, key) in `abuseLimits`, one read-modify-write
 * transaction per call. A denied call is a read-only transaction, so an attacker above the
 * limit costs one read and contends on nothing. The key is stored as an HMAC, never raw, and
 * `expireAt` is the field a Firestore TTL policy deletes on (firestore.indexes.json).
 *
 * Fails CLOSED: a store failure or a missing secret throws AbuseLimiterUnavailableError and the
 * caller refuses the request. firebase-admin is imported lazily so importing this module costs
 * nothing and the pure parts stay testable without it.
 */

export const ABUSE_LIMITS_COLLECTION = 'abuseLimits';

const SECRET_DOMAIN_LABEL = 'abuse-limiter:v1';
const MS_PER_SECOND = 1000;
const KEY_ID_LENGTH = 12;
const IPV6_HEXTETS = 8;
const HEXTET_WIDTH = 4;
const UNKNOWN_ACTOR = 'unknown';

export class AbuseLimiterUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AbuseLimiterUnavailableError';
  }
}

export interface AbuseLimitInput {
  scope: string;
  key: string;
  maxAttempts: number;
  windowMs: number;
  weight?: number;
  now?: Date;
}

export type AbuseLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

type LimiterDocRef = object;

interface LimiterTransaction {
  get(ref: LimiterDocRef): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(ref: LimiterDocRef, data: Record<string, unknown>): unknown;
}

/** The structural subset of Firestore this module uses, so tests can supply an in-memory store. */
export interface LimiterDb {
  collection(name: string): { doc(id: string): LimiterDocRef };
  runTransaction<T>(fn: (transaction: LimiterTransaction) => Promise<T>): Promise<T>;
}

export interface AbuseLimiterDeps {
  db?: LimiterDb;
  secret?: string;
}

interface LimitEntry {
  t: number;
  w: number;
}

export function hashAbuseKey(secret: string, scope: string, key: string): string {
  // anchor: limiter-hash
  return createHmac('sha256', secret).update(`${scope}\0${key}`).digest('hex');
}

function deriveSecret(): string {
  const base = process.env.RECOVERY_TOKEN_SECRET;
  if (!base) return '';
  // anchor: limiter-derive
  return createHmac('sha256', base).update(SECRET_DOMAIN_LABEL).digest('hex');
}

/**
 * Opaque keyed hash of (scope, key) for stamping onto documents (the checkout held-seat budget
 * counts by it). Same HMAC as the limiter's document ids, so no raw address or email is stored.
 */
export function abuseKeyStamp(scope: string, key: string): string {
  const secret = deriveSecret();
  if (!secret) {
    throw new AbuseLimiterUnavailableError('abuse limiter secret is not configured');
  }
  // anchor: stamp-hash
  return hashAbuseKey(secret, scope, key);
}

async function defaultDb(): Promise<LimiterDb> {
  const { getFirestore } = await import('firebase-admin/firestore');
  const { initAdmin } = await import('./firebase-admin');
  // Cast, with reason: the Admin SDK Firestore satisfies this structural subset, but its
  // overloaded generics do not unify with the narrower interface under strict checking.
  return getFirestore(initAdmin()) as unknown as LimiterDb;
}

function parseEntries(data: Record<string, unknown> | undefined): LimitEntry[] {
  const raw = data?.entries;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is LimitEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as LimitEntry).t === 'number' &&
      typeof (entry as LimitEntry).w === 'number',
  );
}

/** Seconds until enough of the oldest live entries age out for `weight` to fit. */
function retryAfterSeconds(live: LimitEntry[], input: AbuseLimitInput, weight: number, nowMs: number): number {
  if (weight > input.maxAttempts) return Math.ceil(input.windowMs / MS_PER_SECOND);
  const ordered = [...live].sort((a, b) => a.t - b.t);
  let used = ordered.reduce((sum, entry) => sum + entry.w, 0);
  for (const entry of ordered) {
    used -= entry.w;
    if (used + weight <= input.maxAttempts) {
      return Math.max(1, Math.ceil((entry.t + input.windowMs - nowMs) / MS_PER_SECOND));
    }
  }
  return Math.ceil(input.windowMs / MS_PER_SECOND);
}

/**
 * Consumes `weight` (default 1) attempts for (scope, key). Allows the Nth attempt, denies the
 * N+1th. Throws AbuseLimiterUnavailableError when the store or secret is unavailable.
 */
export async function consumeAbuseLimit(
  input: AbuseLimitInput,
  deps: AbuseLimiterDeps = {},
): Promise<AbuseLimitDecision> {
  const secret = deps.secret ?? deriveSecret();
  if (!secret) {
    throw new AbuseLimiterUnavailableError('abuse limiter secret is not configured');
  }
  const weight = input.weight ?? 1;
  const nowMs = (input.now ?? new Date()).getTime();
  const keyHash = hashAbuseKey(secret, input.scope, input.key);

  let decision: AbuseLimitDecision;
  try {
    const db = deps.db ?? (await defaultDb());
    // anchor: limiter-doc-id
    const ref = db.collection(ABUSE_LIMITS_COLLECTION).doc(`${input.scope}:${keyHash}`);
    decision = await db.runTransaction(async (transaction): Promise<AbuseLimitDecision> => {
      // anchor: limiter-tx-read
      const snapshot = await transaction.get(ref);
      const entries = snapshot.exists ? parseEntries(snapshot.data()) : [];
      // anchor: limiter-window
      const live = entries.filter((entry) => nowMs - entry.t < input.windowMs);
      const used = live.reduce((sum, entry) => sum + entry.w, 0);
      // anchor: limiter-deny
      if (used + weight > input.maxAttempts) {
        return { allowed: false, retryAfterSeconds: retryAfterSeconds(live, input, weight, nowMs) };
      }
      transaction.set(ref, {
        // anchor: limiter-doc-scope
        scope: input.scope,
        entries: [...live, { t: nowMs, w: weight }],
        expireAt: new Date(nowMs + input.windowMs),
        updatedAt: new Date(nowMs),
      });
      return { allowed: true };
    });
  } catch (error) {
    throw new AbuseLimiterUnavailableError('abuse limiter store failed', { cause: error });
  }

  if (!decision.allowed) {
    console.warn(
      JSON.stringify({
        event: 'abuse-limit-denied',
        // anchor: limiter-log
        scope: input.scope,
        keyId: keyHash.slice(0, KEY_ID_LENGTH),
      }),
    );
  }
  return decision;
}

function expandIpv6(address: string): string[] | null {
  let text = address.toLowerCase();
  const v4Tail = text.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4Tail) {
    const [a, b, c, d] = v4Tail.slice(1).map(Number);
    const high = ((a << 8) | b).toString(16);
    const low = ((c << 8) | d).toString(16);
    text = `${text.slice(0, v4Tail.index)}${high}:${low}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] === '' ? [] : halves[0].split(':');
  const tail = halves.length === 2 && halves[1] !== '' ? halves[1].split(':') : [];
  const fill = IPV6_HEXTETS - head.length - tail.length;
  if (halves.length === 1 ? head.length !== IPV6_HEXTETS : fill < 0) return null;
  const all = halves.length === 1 ? head : [...head, ...new Array<string>(fill).fill('0'), ...tail];
  return all.map((hextet) => hextet.padStart(HEXTET_WIDTH, '0'));
}

/**
 * Actor identity from the forwarded-for header, trusted hop only (second-to-last, see
 * lib/client-ip.ts); entries a client put to the left of it are never read. IPv4 is
 * `ip4:<addr>`, IPv6 is grouped by /64 (`ip6:<first four hextets>`), an IPv4-mapped IPv6
 * address is the IPv4 identity, anything else is the single shared `unknown` bucket.
 */
export function clientActorKey(header: string | null | undefined): string {
  const hop = trustedClientIpFromForwardedFor(header);
  if (hop === null) return UNKNOWN_ACTOR;
  const family = isIP(hop);
  if (family === 4) return `ip4:${hop}`;
  if (family === 6) {
    const hextets = expandIpv6(hop);
    if (hextets === null) return UNKNOWN_ACTOR;
    // anchor: ipv4-mapped
    if (hextets[5] === 'ffff' && hextets.slice(0, 5).every((hextet) => hextet === '0000')) {
      const high = parseInt(hextets[6], 16);
      const low = parseInt(hextets[7], 16);
      return `ip4:${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
    }
    // anchor: ipv6-prefix
    return `ip6:${hextets.slice(0, 4).join(':')}`;
  }
  return UNKNOWN_ACTOR;
}
