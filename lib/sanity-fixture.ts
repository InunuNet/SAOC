// =============================================================
// SAOC — lib/sanity-fixture.ts
// Replay (and, once, record) of Sanity GROQ reads from files on disk, so a check run makes no
// Sanity API request. Wrapped around the client in sanity/lib/client.ts.
//
// Modes (SANITY_FIXTURE_MODE): off (unset) | replay | record. SANITY_FIXTURE_DIR alone does
// nothing.
// FAIL-CLOSED: a mode other than off throws on the hosted runtime (K_SERVICE), at module load, and
// record also needs SANITY_FIXTURE_RECORD_CONFIRM=1. The directory comes only from the environment.
// Relative imports only, so a bare tsx load works.
// =============================================================

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { isHostedRuntime } from './fixture-route-guard';

type FixtureMode = 'off' | 'replay' | 'record';
type Params = Record<string, unknown>;
type FetchOptions = Record<string, unknown> & { perspective?: unknown };
type Fetcher = {
  fetch: (query: string, params?: Params, options?: FetchOptions) => Promise<unknown>;
  withConfig: (config: Record<string, unknown>) => Fetcher;
};

const MODES: readonly string[] = ['off', 'replay', 'record'];
const RECORD_CONFIRM_FLAG = '1';
const PUBLISHED_PERSPECTIVE = 'published';
const MISS_QUERY_CHARS = 200;
const FIXTURE_LOG = {
  requests: '_requests.log',
  hits: '_hits.log',
  misses: '_misses.log',
  started: '_started.log',
} as const;

export class SanityFixtureMiss extends Error {
  // No statusCode, status or response: a miss must never look like a transient HTTP failure to a
  // 402/429/5xx fallback above the client.
  constructor(readonly key: string, query: string) {
    super(`Sanity fixture miss ${key}: ${query.trim().slice(0, MISS_QUERY_CHARS)}`);
    this.name = 'SanityFixtureMiss';
  }
}

function modeOf(env: NodeJS.ProcessEnv): FixtureMode {
  const raw = env.SANITY_FIXTURE_MODE || 'off';
  if (!MODES.includes(raw)) {
    throw new Error(`SANITY_FIXTURE_MODE must be off, replay or record (got "${raw}")`);
  }
  return raw as FixtureMode; // validated against MODES above
}

export function assertFixtureEnv(env: NodeJS.ProcessEnv = process.env): void {
  const mode = modeOf(env);
  if (mode === 'off') return;
  if (Boolean(env.K_SERVICE) || isHostedRuntime()) {
    throw new Error(`SANITY_FIXTURE_MODE=${mode} is refused on the hosted runtime (K_SERVICE)`);
  }
  if (!env.SANITY_FIXTURE_DIR) {
    throw new Error(`SANITY_FIXTURE_MODE=${mode} needs SANITY_FIXTURE_DIR`);
  }
  if (mode === 'record' && env.SANITY_FIXTURE_RECORD_CONFIRM !== RECORD_CONFIRM_FLAG) {
    throw new Error('SANITY_FIXTURE_MODE=record needs SANITY_FIXTURE_RECORD_CONFIRM=1');
  }
}

assertFixtureEnv();

export function isFixtureActive(): boolean {
  return modeOf(process.env) !== 'off';
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>; // a plain JSON object by construction
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, canonical(source[key])]),
    );
  }
  return value;
}

/** sha256 of the trimmed query, a newline and the params with keys sorted recursively. */
export function fixtureKey(query: string, params?: Params | null): string {
  const body = JSON.stringify(canonical(params ?? {}));
  return createHash('sha256').update(`${query.trim()}\n${body}`).digest('hex');
}

interface FixtureContext {
  mode: Exclude<FixtureMode, 'off'>;
  dir: string;
  logDir: string;
}

let startedLine = '';

function appendLog(ctx: FixtureContext, file: string, line: string): void {
  mkdirSync(ctx.logDir, { recursive: true });
  appendFileSync(`${ctx.logDir}/${file}`, `${line}\n`);
}

function logStart(ctx: FixtureContext): void {
  const line = `mode=${ctx.mode} dir=${ctx.dir} pid=${process.pid}`;
  if (line === startedLine) return;
  startedLine = line;
  appendLog(ctx, FIXTURE_LOG.started, line);
}

function readEntry(ctx: FixtureContext, key: string): { result: unknown } | null {
  const file = `${ctx.dir}/${key}.json`;
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as { result: unknown }; // written by record below
}

function replayFetch(
  ctx: FixtureContext,
  query: string,
  params: Params | undefined,
  options: FetchOptions | undefined,
): unknown {
  const key = fixtureKey(query, params);
  const perspective = options?.perspective;
  const draft = perspective !== undefined && perspective !== PUBLISHED_PERSPECTIVE;
  const entry = draft ? null : readEntry(ctx, key);
  if (!entry) {
    const flat = query.trim().replace(/\s+/g, ' ').slice(0, MISS_QUERY_CHARS);
    appendLog(ctx, FIXTURE_LOG.misses, `${key} ${flat}`);
    throw new SanityFixtureMiss(key, query);
  }
  appendLog(ctx, FIXTURE_LOG.hits, key);
  return entry.result;
}

async function recordFetch(
  ctx: FixtureContext,
  target: Fetcher,
  query: string,
  params: Params | undefined,
  options: FetchOptions | undefined,
): Promise<unknown> {
  const key = fixtureKey(query, params);
  const saved = readEntry(ctx, key);
  if (saved) return saved.result;
  const api = target.withConfig({ useCdn: false });
  const result = await api.fetch(query, params, { ...options, useCdn: false });
  mkdirSync(ctx.dir, { recursive: true });
  const entry = { query, params: params ?? {}, result, capturedAt: new Date().toISOString() };
  writeFileSync(`${ctx.dir}/${key}.json`, JSON.stringify(entry));
  appendLog(ctx, FIXTURE_LOG.requests, key);
  return result;
}

/** The client itself when the fixture is off; otherwise a wrapper whose reads come from disk. */
export function withFixture<C extends object>(client: C): C {
  assertFixtureEnv();
  const mode = modeOf(process.env);
  if (mode === 'off') return client;
  const dir = process.env.SANITY_FIXTURE_DIR as string; // assertFixtureEnv required it
  const ctx: FixtureContext = { mode, dir, logDir: process.env.SANITY_FIXTURE_LOGDIR || dir };
  const target = client as unknown as Fetcher; // the Sanity client's read surface used here
  return new Proxy(client, {
    get(base, prop) {
      if (prop === 'fetch') {
        return (query: string, params?: Params, options?: FetchOptions) => {
          logStart(ctx);
          if (ctx.mode === 'record') return recordFetch(ctx, target, query, params, options);
          try {
            return Promise.resolve(replayFetch(ctx, query, params, options));
          } catch (error) {
            return Promise.reject(error);
          }
        };
      }
      if (prop === 'withConfig') {
        return (config: Record<string, unknown>) => withFixture(target.withConfig(config));
      }
      const value = Reflect.get(base, prop, base) as unknown;
      if (typeof value !== 'function') return value;
      return (value as (...args: unknown[]) => unknown).bind(base);
    },
  });
}
