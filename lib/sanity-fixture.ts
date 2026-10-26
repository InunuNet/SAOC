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

import { isHostedRuntime } from './fixture-route-guard';

// This module is reachable from client bundles through sanity/lib/client.ts, where node:fs must not
// be resolved at build time. The fixture is only ever active on the server, so the built-ins are
// taken from the running process when first needed instead of being imported.
const nodeFs = () => process.getBuiltinModule('node:fs');
const sha256 = (text: string): string =>
  process.getBuiltinModule('node:crypto').createHash('sha256').update(text).digest('hex');

type FixtureMode = 'off' | 'replay' | 'record';
type Params = Record<string, unknown>;
type FetchOptions = Record<string, unknown> & { perspective?: unknown };
type Fetcher = {
  fetch: (query: string, params?: Params, options?: FetchOptions) => Promise<unknown>;
  withConfig: (config: Record<string, unknown>) => Fetcher;
  config?: () => Record<string, unknown>;
  clone: () => Fetcher;
};

const MODES: readonly string[] = ['off', 'replay', 'record'];
const RECORD_CONFIRM_FLAG = '1';
const PUBLISHED_PERSPECTIVE = 'published';
const MISS_QUERY_CHARS = 200;
const SECRET_PARAM_NAME = /token|secret|password|key/i;
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

/** True for a perspective other than the published default (a draft or raw read). */
function isDraftPerspective(perspective: unknown): boolean {
  return perspective !== undefined && perspective !== PUBLISHED_PERSPECTIVE;
}

/** sha256 of the trimmed query, a newline and the params with keys sorted recursively. A
 * non-published perspective is appended after another newline, so a published read keeps the same
 * key it always had and a draft read can never share it. */
export function fixtureKey(query: string, params?: Params | null, perspective?: unknown): string {
  const body = JSON.stringify(canonical(params ?? {}));
  const suffix = isDraftPerspective(perspective) ? `\n${JSON.stringify(perspective)}` : '';
  return sha256(`${query.trim()}\n${body}${suffix}`);
}

interface FixtureContext {
  mode: Exclude<FixtureMode, 'off'>;
  dir: string;
  logDir: string;
}

let startedLine = '';

function appendLog(ctx: FixtureContext, file: string, line: string): void {
  const fs = nodeFs();
  fs.mkdirSync(ctx.logDir, { recursive: true });
  fs.appendFileSync(`${ctx.logDir}/${file}`, `${line}\n`);
}

function logStart(ctx: FixtureContext): void {
  const line = `mode=${ctx.mode} dir=${ctx.dir} pid=${process.pid}`;
  if (line === startedLine) return;
  startedLine = line;
  appendLog(ctx, FIXTURE_LOG.started, line);
}

function readEntry(ctx: FixtureContext, key: string): { result: unknown } | null {
  const file = `${ctx.dir}/${key}.json`;
  const fs = nodeFs();
  if (!fs.existsSync(file)) return null;
  // The file is written by recordFetch below.
  return JSON.parse(fs.readFileSync(file, 'utf8')) as { result: unknown };
}

function replayFetch(
  ctx: FixtureContext,
  query: string,
  params: Params | undefined,
  options: FetchOptions | undefined,
): unknown {
  const key = fixtureKey(query, params, options?.perspective);
  const draft = isDraftPerspective(options?.perspective);
  const entry = draft ? null : readEntry(ctx, key);
  if (!entry) {
    const flat = query.trim().replace(/\s+/g, ' ').slice(0, MISS_QUERY_CHARS);
    appendLog(ctx, FIXTURE_LOG.misses, `${key} ${flat}`);
    throw new SanityFixtureMiss(key, query);
  }
  appendLog(ctx, FIXTURE_LOG.hits, key);
  return entry.result;
}

/** The first object key that looks like a credential, searched through nested objects and arrays. */
function findSecretName(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSecretName(item);
      if (found) return found;
    }
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  for (const [name, inner] of Object.entries(value)) {
    if (SECRET_PARAM_NAME.test(name)) return name;
    const found = findSecretName(inner);
    if (found) return found;
  }
  return undefined;
}

/** Record mode writes params and results to disk verbatim, so it refuses a client that carries a
 * token and any param, at any depth, whose name looks like a credential. It runs before any saved
 * entry is read or any request is made. */
function assertRecordable(target: Fetcher, params: Params | undefined): void {
  if (target.config?.().token) {
    throw new Error('Sanity fixture record refuses a client configured with a token');
  }
  const secretParam = findSecretName(params);
  if (secretParam) {
    throw new Error(`Sanity fixture record refuses a param named "${secretParam}"`);
  }
}

async function recordFetch(
  ctx: FixtureContext,
  target: Fetcher,
  query: string,
  params: Params | undefined,
  options: FetchOptions | undefined,
): Promise<unknown> {
  assertRecordable(target, params);
  const key = fixtureKey(query, params, options?.perspective);
  const saved = readEntry(ctx, key);
  if (saved) return saved.result;
  const api = target.withConfig({ useCdn: false });
  const result = await api.fetch(query, params, { ...options, useCdn: false });
  const fs = nodeFs();
  fs.mkdirSync(ctx.dir, { recursive: true });
  const entry = { query, params: params ?? {}, result, capturedAt: new Date().toISOString() };
  fs.writeFileSync(`${ctx.dir}/${key}.json`, JSON.stringify(entry));
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
      if (prop === 'clone') return () => withFixture(target.clone());
      const value = Reflect.get(base, prop, base) as unknown;
      if (typeof value !== 'function') return value;
      return (value as (...args: unknown[]) => unknown).bind(base);
    },
  });
}
